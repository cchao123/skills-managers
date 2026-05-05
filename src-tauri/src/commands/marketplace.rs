use crate::commands::skills::copy_dir_recursive;
use crate::settings::AppSettingsManager;
use log::info;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncReadExt;

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

            // hot 页面展示 24h 变化量而非总安装量
            let display_installs = if source_type.as_deref() == Some("hot") {
                s.change.map(|c| c.unsigned_abs())
            } else {
                s.installs
            };

            MarketplaceSkill {
                id: s.skill_id.clone(),
                name: s.name.clone(),
                description: s.description.unwrap_or_else(|| s.source.clone()),
                author: owner,
                repository: format!("https://github.com/{}", s.source),
                branch: Some("main".to_string()),
                stars: display_installs,
                updated_at: None,
            }
        })
        .collect();

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

    Ok(resp
        .skills
        .into_iter()
        .map(|s| {
            let owner = s.source.splitn(2, '/').next().unwrap_or("").to_string();
            MarketplaceSkill {
                id: s.skill_id.clone(),
                name: s.name.clone(),
                description: s.description.unwrap_or_else(|| s.source.clone()),
                author: owner,
                repository: format!("https://github.com/{}", s.source),
                branch: Some("main".to_string()),
                stars: s.installs,
                updated_at: None,
            }
        })
        .collect())
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

    // 启动 git clone，不指定分支（自动用仓库默认分支），强制输出进度到 stderr
    let mut child = tokio::process::Command::new("git")
        .args([
            "clone",
            "--depth", "1",
            "--single-branch",
            "--progress",
            &repository,
            &temp_dir_str,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("无法运行 git 命令: {}（请确认已安装 Git）", e))?;

    // 逐块读取 stderr，解析进度并 emit 事件
    // git 用 \r 覆写同一行更新进度，不能用 read_line
    let mut stderr_handle = child.stderr.take().unwrap();
    let mut buf = [0u8; 512];
    let mut current_line = String::new();
    let mut all_stderr = String::new();

    loop {
        let n = stderr_handle.read(&mut buf).await.unwrap_or(0);
        if n == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buf[..n]);
        all_stderr.push_str(&chunk);

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

    let status = child.wait().await
        .map_err(|e| format!("等待 git 完成失败: {}", e))?;

    if !status.success() {
        return Err(format!("克隆仓库失败: {}", all_stderr.trim()));
    }

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

    // 发送完成进度
    app_handle.emit("download-progress", DownloadProgressPayload {
        skill_id: skill_id.clone(),
        percent: 100,
    }).ok();

    info!("Successfully downloaded skill '{}' to: {:?}", skill_id, target_path);
    Ok(skill_id)
}

/// 在仓库中查找技能目录
/// 规则:
/// 1. 如果根目录有 SKILL.md,则根目录就是技能目录
/// 2. 如果 skills/<skill_id>/SKILL.md 存在,则使用该目录
/// 3. 如果 <skill_id>/SKILL.md 存在,则使用该目录
fn find_skill_directory(repo_path: &Path, skill_id: &str) -> Result<PathBuf, String> {
    // 检查根目录
    let root_skill = repo_path.join("SKILL.md");
    if root_skill.exists() {
        return Ok(repo_path.to_path_buf());
    }

    // 检查 skills/<skill_id>/
    let skills_subdir = repo_path.join("skills").join(skill_id).join("SKILL.md");
    if skills_subdir.exists() {
        return Ok(skills_subdir.parent().unwrap().to_path_buf());
    }

    // 检查 <skill_id>/
    let skill_subdir = repo_path.join(skill_id).join("SKILL.md");
    if skill_subdir.exists() {
        return Ok(skill_subdir.parent().unwrap().to_path_buf());
    }

    Err(format!("在仓库中找不到技能目录: {}", skill_id))
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
