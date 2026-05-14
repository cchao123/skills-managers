use crate::commands::skills::copy_dir_recursive;
use crate::settings::AppSettingsManager;
use log::info;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read as StdRead;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

/// 按 (repository, id) 联合去重：同仓库同 id 才视为重复，跨仓库同 id 视为不同技能
/// 重复时保留 stars（installs）最高的一条；未知 stars 视为 0
fn dedupe_by_id(skills: Vec<MarketplaceSkill>) -> Vec<MarketplaceSkill> {
    let mut seen: HashMap<(String, String), usize> = HashMap::new();
    let mut result: Vec<MarketplaceSkill> = Vec::with_capacity(skills.len());
    for s in skills {
        let key = (s.repository.clone(), s.id.clone());
        match seen.get(&key) {
            Some(&idx) => {
                if s.stars.unwrap_or(0) > result[idx].stars.unwrap_or(0) {
                    result[idx] = s;
                }
            }
            None => {
                seen.insert(key, result.len());
                result.push(s);
            }
        }
    }
    result
}

/// 技能市场中的技能条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub repository: String,
    pub branch: Option<String>,
    pub stars: Option<u32>,
    pub updated_at: Option<String>,
    /// Hot 页面专用：相对上一时段的安装数变化（带符号）。其它页签为 None。
    pub change: Option<i32>,
}

/// 技能详情（从详情页 RSC 解析）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAudit {
    pub name: String,
    pub status: String, // "Pass" | "Warn" | "Fail"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceSkillDetail {
    pub weekly_installs: Option<String>,
    pub github_stars: Option<String>,
    pub first_seen: Option<String>,
    pub security_audits: Vec<SecurityAudit>,
}

/// 在 RSC payload 中找到标签文字后，提取紧跟的第一个 children 值
fn extract_after_label(rsc: &str, label: &str) -> Option<String> {
    let marker = format!(r#""children":"{}""#, label);
    let pos = rsc.find(&marker)?;
    let after = &rsc[pos + marker.len()..][..2000.min(rsc.len() - pos - marker.len())];
    // 匹配 "children":"VALUE"，VALUE 不以 $ 或 [ 开头（排除子组件引用）
    let re = Regex::new(r#""children":"([^"\[\$\{][^"]{0,80})""#).ok()?;
    re.captures(after)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// 解析安全审计列表
fn parse_security_audits(rsc: &str) -> Vec<SecurityAudit> {
    // 每条审计：先是名称 span，后是状态 span（class 含 bg-green/amber/red-500/10）
    let re = Regex::new(
        r#""text-sm font-medium text-foreground truncate","children":"([^"]+)"\}\],\["\$","span",null,\{"className":"[^"]*bg-(green|amber|red)-500/10[^"]*","children":"(Pass|Warn|Fail)""#
    ).unwrap_or_else(|_| Regex::new(r"$^").unwrap());

    re.captures_iter(rsc)
        .map(|c| SecurityAudit {
            name: c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
            status: c.get(3).map(|m| m.as_str().to_string()).unwrap_or_default(),
        })
        .collect()
}

/// 获取技能详情（Weekly Installs、GitHub Stars、首次出现时间、安全审计）
#[tauri::command]
pub async fn fetch_skill_detail(source: String, skill_id: String) -> Result<MarketplaceSkillDetail, String> {
    let url = format!("https://skills.sh/{}/{}", source, skill_id);
    info!("Fetching skill detail from: {}", url);

    let response = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0 (compatible; skills-manager)")
        .set("RSC", "1")
        .call()
        .map_err(|e| format!("请求详情页失败: {}", e))?;

    let rsc_text = response
        .into_string()
        .map_err(|e| format!("读取响应失败: {}", e))?;

    Ok(MarketplaceSkillDetail {
        weekly_installs: extract_after_label(&rsc_text, "Weekly Installs"),
        github_stars: extract_after_label(&rsc_text, "GitHub Stars"),
        first_seen: extract_after_label(&rsc_text, "First Seen"),
        security_audits: parse_security_audits(&rsc_text),
    })
}

/// 从 skills.sh 详情页 HTML 中抠出 `<div class="prose ...">…</div>` 的内联 HTML。
/// 简单的栈式扫描，匹配同级 `<div>` 标签深度，遇到对应的 `</div>` 时停止。
fn extract_prose_html(html: &str) -> Option<String> {
    let marker = "class=\"prose ";
    let class_pos = html.find(marker)?;
    let tag_open = html[..class_pos].rfind("<div")?;
    let after_open = tag_open + html[tag_open..].find('>')? + 1;

    let bytes = html.as_bytes();
    let mut depth: i32 = 1;
    let mut i = after_open;
    while i < bytes.len() {
        if html[i..].starts_with("<div") {
            // 排除形如 <divider 这种以 div 开头的非 div 标签
            let next = bytes.get(i + 4).copied();
            if matches!(next, Some(b' ') | Some(b'>') | Some(b'\t') | Some(b'\n') | Some(b'/')) {
                depth += 1;
                i += 4;
                continue;
            }
        }
        if html[i..].starts_with("</div>") {
            depth -= 1;
            if depth == 0 {
                return Some(html[after_open..i].to_string());
            }
            i += 6;
            continue;
        }
        i += 1;
    }
    None
}

/// 拉取 skills.sh 详情页中已渲染好的 SKILL.md 内容（HTML 形式）。
/// 直接抓 `https://skills.sh/{source}/{skill_id}` 页面 HTML，
/// 提取 `<div class="prose ...">` 容器的内部 HTML 返回，
/// 前端用 dangerouslySetInnerHTML 展示，可同步切换到纯文本模式。
#[tauri::command]
pub async fn fetch_marketplace_skill_content(
    source: String,
    skill_id: String,
) -> Result<String, String> {
    let url = format!("https://skills.sh/{}/{}", source, skill_id);
    info!("Fetching skill content from: {}", url);

    let response = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0 (compatible; skills-manager)")
        .call()
        .map_err(|e| format!("请求 skills.sh 详情页失败: {}", e))?;

    if response.status() != 200 {
        return Err(format!("skills.sh 返回 {}", response.status()));
    }

    let html = response
        .into_string()
        .map_err(|e| format!("读取响应失败: {}", e))?;

    extract_prose_html(&html)
        .ok_or_else(|| "在 skills.sh 详情页中未找到 SKILL.md 内容(可能页面结构有变化)".to_string())
}

/// 技能市场分类
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct MarketplaceCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub skills: Vec<MarketplaceSkill>,
}

/// 从 skills.sh 页面的 RSC payload 中提取 initialSkills 数据
fn parse_rsc_initial_skills(rsc_text: &str) -> Result<Vec<RscSkill>, String> {
    // RSC payload 中 initialSkills 以 JSON 数组形式嵌入
    // 格式: "initialSkills":[{...},{...}]
    let start_marker = "\"initialSkills\":[";
    let start = rsc_text
        .find(start_marker)
        .ok_or_else(|| "未在 RSC payload 中找到 initialSkills".to_string())?;

    let array_start = start + start_marker.len() - 1; // 指向 '['
    // 以字节扫描匹配括号（JSON 结构字符均为 ASCII 单字节）
    let slice = &rsc_text[array_start..];
    let bytes = slice.as_bytes();
    let mut depth = 0usize;
    let mut end_offset = 0usize;
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'[' | b'{' => depth += 1,
            b']' | b'}' => {
                depth -= 1;
                if depth == 0 {
                    end_offset = i + 1;
                    break;
                }
            }
            _ => {}
        }
    }
    if end_offset == 0 {
        return Err("无法解析 initialSkills 数组边界".to_string());
    }

    let array_json = &slice[..end_offset];
    serde_json::from_str::<Vec<RscSkill>>(array_json)
        .map_err(|e| format!("解析 initialSkills JSON 失败: {}", e))
}

#[derive(Deserialize)]
struct RscSkill {
    source: String,
    #[serde(rename = "skillId")]
    skill_id: String,
    name: String,
    description: Option<String>,
    installs: Option<u32>,
    // hot 页面专属字段
    change: Option<i32>,
}

/// 从 skills.sh 获取技能列表
#[tauri::command]
pub async fn fetch_marketplace_skills(
    category: Option<String>,
    source_type: Option<String>, // "allTime", "trending", 或 "hot"
    _state: State<'_, crate::state::AppState>,
) -> Result<Vec<MarketplaceSkill>, String> {
    info!(
        "Fetching marketplace skills from skills.sh, category: {:?}, source: {:?}",
        category, source_type
    );

    // 如果有搜索关键词，走 search API
    if let Some(ref q) = category {
        if !q.is_empty() {
            return fetch_by_search(q).await;
        }
    }

    // 根据 sourceType 选择对应页面
    let page_url = match source_type.as_deref() {
        Some("trending") => "https://skills.sh/trending",
        Some("hot") => "https://skills.sh/hot",
        _ => "https://skills.sh/",
    };

    // 用 RSC: 1 请求，让服务端返回流式组件数据（含 initialSkills）
    let response = ureq::get(page_url)
        .set("User-Agent", "Mozilla/5.0 (compatible; skills-manager)")
        .set("RSC", "1")
        .call()
        .map_err(|e| format!("请求 skills.sh 失败: {}", e))?;

    let rsc_text = response
        .into_string()
        .map_err(|e| format!("读取响应失败: {}", e))?;

    let rsc_skills = parse_rsc_initial_skills(&rsc_text)?;

    let skills: Vec<MarketplaceSkill> = rsc_skills
        .into_iter()
        .map(|s| {
            let source_parts: Vec<&str> = s.source.splitn(2, '/').collect();
            let owner = source_parts.first().copied().unwrap_or("").to_string();

            let is_hot = source_type.as_deref() == Some("hot");
            MarketplaceSkill {
                id: s.skill_id.clone(),
                name: s.name.clone(),
                description: s.description.unwrap_or_default(),
                author: owner,
                repository: format!("https://github.com/{}", s.source),
                branch: Some("main".to_string()),
                // Hot 页 installs 为 1H 安装数；其它页签为总安装量/趋势安装量
                stars: s.installs,
                updated_at: None,
                // 仅 Hot 页携带 change 字段，前端据此决定列展示方式
                change: if is_hot { s.change } else { None },
            }
        })
        .collect();

    let skills = dedupe_by_id(skills);
    info!("Fetched {} skills from skills.sh ({})", skills.len(), page_url);
    Ok(skills)
}

/// 通过搜索关键词获取技能
async fn fetch_by_search(query: &str) -> Result<Vec<MarketplaceSkill>, String> {
    let api_url = format!(
        "https://skills.sh/api/search?q={}&limit=200&sortBy=installs&sortOrder=desc",
        query
    );

    let response = ureq::get(&api_url)
        .set("User-Agent", "Mozilla/5.0 (compatible; skills-manager)")
        .call()
        .map_err(|e| format!("搜索请求失败: {}", e))?;

    let text = response
        .into_string()
        .map_err(|e| format!("读取搜索结果失败: {}", e))?;

    #[derive(Deserialize)]
    struct SearchResponse {
        skills: Vec<SearchSkill>,
    }
    #[derive(Deserialize)]
    struct SearchSkill {
        #[serde(rename = "skillId")]
        skill_id: String,
        name: String,
        description: Option<String>,
        installs: Option<u32>,
        source: String,
    }

    let resp: SearchResponse =
        serde_json::from_str(&text).map_err(|e| format!("解析搜索结果失败: {}", e))?;

    let skills: Vec<MarketplaceSkill> = resp
        .skills
        .into_iter()
        .map(|s| {
            let owner = s.source.splitn(2, '/').next().unwrap_or("").to_string();
            MarketplaceSkill {
                id: s.skill_id.clone(),
                name: s.name.clone(),
                description: s.description.unwrap_or_default(),
                author: owner,
                repository: format!("https://github.com/{}", s.source),
                branch: Some("main".to_string()),
                stars: s.installs,
                updated_at: None,
                change: None,
            }
        })
        .collect();
    Ok(dedupe_by_id(skills))
}

/// git stderr 进度行 → 整体进度百分比（0-100）
/// git 各阶段：Counting(5%) → Compressing(5-25%) → Receiving(25-95%) → Resolving(95-100%)
fn parse_git_progress(line: &str) -> Option<u8> {
    fn extract_pct(line: &str, marker: &str) -> Option<u32> {
        let after = line.split(marker).nth(1)?;
        let trimmed = after.trim_start();
        let end = trimmed.find('%')?;
        trimmed[..end].trim().parse().ok()
    }

    if line.contains("Receiving objects:") {
        let p = extract_pct(line, "Receiving objects:")?;
        Some((25 + p * 70 / 100).min(95) as u8)
    } else if line.contains("Compressing objects:") {
        let p = extract_pct(line, "Compressing objects:")?;
        Some((5 + p * 20 / 100) as u8)
    } else if line.contains("Resolving deltas:") {
        let p = extract_pct(line, "Resolving deltas:")?;
        Some((95 + p * 5 / 100) as u8)
    } else if line.contains("Counting objects:") {
        Some(5)
    } else {
        None
    }
}

#[derive(Clone, Serialize)]
struct DownloadProgressPayload {
    skill_id: String,
    percent: u8,
}

/// 从指定的 GitHub 仓库克隆技能到本地
#[tauri::command]
pub async fn download_skill_from_marketplace(
    skill_id: String,
    repository: String,
    branch: Option<String>,
    target_agent: Option<String>,
    state: State<'_, crate::state::AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // branch 当前未使用：git clone 走仓库默认分支；保留参数以兼容前端 API
    let _ = branch;

    info!(
        "Downloading skill '{}' from '{}' to agent: {:?}",
        skill_id, repository, target_agent
    );

    if !repository.contains("github.com") {
        return Err("目前仅支持从 GitHub 仓库下载技能".to_string());
    }

    let repo_path = repository
        .trim_start_matches("https://github.com/")
        .trim_start_matches("http://github.com/")
        .trim_end_matches(".git");

    let parts: Vec<&str> = repo_path.splitn(2, '/').collect();
    if parts.len() < 2 {
        return Err(format!("无效的 GitHub 仓库 URL: {}", repository));
    }
    let owner = parts[0];
    let repo_name = parts[1];

    let temp_dir = std::env::temp_dir()
        .join(format!("skill-dl-{}-{}-{}", owner, repo_name, skill_id));

    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("清理临时目录失败: {}", e))?;
    }

    let temp_dir_str = temp_dir
        .to_str()
        .ok_or("临时目录路径包含非 UTF-8 字符")?
        .to_string();

    // 发送初始进度
    app_handle.emit("download-progress", DownloadProgressPayload {
        skill_id: skill_id.clone(),
        percent: 0,
    }).ok();

    // 在 spawn_blocking 中执行 git clone（防止 Windows 弹窗）
    let _clone_result = tokio::task::spawn_blocking({
        let repository = repository.clone();
        let temp_dir_str = temp_dir_str.clone();
        let skill_id = skill_id.clone();
        let app_handle = app_handle.clone();

        move || -> Result<(), String> {
            #[cfg(windows)]
            use std::os::windows::process::CommandExt;

            let mut cmd = std::process::Command::new("git");
            cmd.args([
                "clone",
                "--depth", "1",
                "--single-branch",
                "--progress",
                &repository,
                &temp_dir_str,
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped());

            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

            let mut child = cmd.spawn()
                .map_err(|e| format!("无法运行 git 命令: {}（请确认已安装 Git）", e))?;

            // 读取 stderr 解析进度
            let mut stderr_handle = child.stderr.take().unwrap();
            let mut buf = [0u8; 512];
            let mut current_line = String::new();

            loop {
                let n = stderr_handle.read(&mut buf).unwrap_or(0);
                if n == 0 {
                    break;
                }
                let chunk = String::from_utf8_lossy(&buf[..n]);

                for ch in chunk.chars() {
                    if ch == '\r' || ch == '\n' {
                        let line = current_line.trim().to_string();
                        if !line.is_empty() {
                            if let Some(pct) = parse_git_progress(&line) {
                                app_handle.emit("download-progress", DownloadProgressPayload {
                                    skill_id: skill_id.clone(),
                                    percent: pct,
                                }).ok();
                            }
                        }
                        current_line.clear();
                    } else {
                        current_line.push(ch);
                    }
                }
            }

            let status = child.wait()
                .map_err(|e| format!("等待 git 完成失败: {}", e))?;

            if !status.success() {
                return Err("克隆仓库失败".to_string());
            }

            Ok(())
        }
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    // 在克隆好的仓库中查找技能目录
    let skill_source_path = find_skill_directory(&temp_dir, &skill_id)?;

    // 确定目标路径
    let target_path = {
        let settings = state
            .settings_manager
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        let config = settings.get_config();

        if let Some(agent_name) = target_agent {
            let agent_config = config
                .agents
                .iter()
                .find(|a| a.name == agent_name)
                .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;

            let agent_path = expand_tilde_path(&agent_config.path)
                .ok_or_else(|| format!("Failed to expand path for agent '{}'", agent_name))?;

            agent_path.join(&agent_config.skills_path).join(&skill_id)
        } else {
            AppSettingsManager::get_skills_dir().join(&skill_id)
        }
    };

    if target_path.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("目标位置已存在技能 '{}',请先删除后再下载", skill_id));
    }

    std::fs::create_dir_all(&target_path)
        .map_err(|e| format!("创建目标目录失败: {}", e))?;

    copy_dir_recursive(&skill_source_path, &target_path)
        .map_err(|e| {
            let _ = std::fs::remove_dir_all(&target_path);
            format!("复制技能文件失败: {}", e)
        })?;

    let _ = std::fs::remove_dir_all(&temp_dir);

    // 写入来源仓库 URL，供 installer 识别"是哪个 marketplace 仓库"
    let _ = std::fs::write(target_path.join(".skill-source"), &repository);

    // 发送完成进度
    app_handle.emit("download-progress", DownloadProgressPayload {
        skill_id: skill_id.clone(),
        percent: 100,
    }).ok();

    info!("Successfully downloaded skill '{}' to: {:?}", skill_id, target_path);
    Ok(skill_id)
}

/// 生成 skill_id 的备选变体（用于 skills.sh 添加了 org 前缀但 repo 内未加的情况）。
/// 例如 `vercel-react-best-practices` 实际目录是 `react-best-practices`,
/// 这里依次返回 `["vercel-react-best-practices", "react-best-practices", "best-practices", "practices"]`。
fn skill_id_variants(skill_id: &str) -> Vec<String> {
    let mut out = vec![skill_id.to_string()];
    let parts: Vec<&str> = skill_id.split('-').collect();
    for i in 1..parts.len() {
        out.push(parts[i..].join("-"));
    }
    out
}

/// 在仓库中查找技能目录
/// 策略：
/// 1. 根目录有 SKILL.md → 根目录即技能目录
/// 2. 对每个 skill_id 变体，递归遍历整个仓库（最深 4 层），
///    找到名为 <variant> 且含 SKILL.md 的目录
fn find_skill_directory(repo_path: &Path, skill_id: &str) -> Result<PathBuf, String> {
    // 1. 检查根目录
    if repo_path.join("SKILL.md").exists() {
        return Ok(repo_path.to_path_buf());
    }

    // 2. 对每个变体做递归查找（跳过 .git，最多 4 层深）
    for variant in skill_id_variants(skill_id) {
        if let Some(found) = find_named_dir_with_skill_md(repo_path, &variant, 0) {
            return Ok(found);
        }
    }

    Err(format!("在仓库中找不到技能目录: {}", skill_id))
}

/// 递归查找：在 base 的子目录树中（当前深度 depth，最多 4 层），
/// 找到以下任一条件的目录：
/// 1. 目录名 == target_name 且含 SKILL.md
/// 2. 含 SKILL.md 且其 frontmatter 的 `name:` 字段 == target_name
fn find_named_dir_with_skill_md(base: &Path, target_name: &str, depth: usize) -> Option<PathBuf> {
    if depth >= 4 {
        return None;
    }
    let Ok(entries) = std::fs::read_dir(base) else {
        return None;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if dir_name == ".git" || dir_name == "node_modules" {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if skill_md.exists() {
            // 优先匹配目录名
            if dir_name == target_name {
                return Some(path);
            }
            // 目录名不符时，读 SKILL.md frontmatter 的 name 字段再比对
            if let Ok(content) = std::fs::read_to_string(&skill_md) {
                if skill_md_name_matches(&content, target_name) {
                    return Some(path);
                }
            }
        }
        if let Some(found) = find_named_dir_with_skill_md(&path, target_name, depth + 1) {
            return Some(found);
        }
    }
    None
}

/// 快速检查 SKILL.md frontmatter 里 `name:` 字段是否等于 expected（不完整 YAML 解析，性能优先）
fn skill_md_name_matches(content: &str, expected: &str) -> bool {
    let frontmatter = content
        .strip_prefix("---")
        .and_then(|s| s.find("\n---").map(|end| &s[..end]))
        .unwrap_or("");
    frontmatter.lines().any(|line| {
        let line = line.trim();
        line.starts_with("name:") && line[5..].trim() == expected
    })
}

/// 展开路径中的 ~ 为用户主目录
fn expand_tilde_path(path: &str) -> Option<PathBuf> {
    if let Some(rest) = path.strip_prefix("~/") {
        dirs::home_dir().map(|h| h.join(rest))
    } else if path == "~" {
        dirs::home_dir()
    } else {
        Some(PathBuf::from(path))
    }
}
