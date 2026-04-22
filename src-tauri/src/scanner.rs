use crate::linker::is_junction_or_symlink;
use crate::models::{
    pick_default_primary, AgentConfig, SkillEntry, SkillMetadata, SOURCE_GLOBAL,
};
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use thiserror::Error;
use walkdir::WalkDir;

// ========== Schema v2 Scanner ==========

#[derive(Debug, Error)]
pub enum ScannerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid SKILL.md format: {0}")]
    InvalidFormat(String),

    #[error("Missing required field: {0}")]
    MissingField(String),
}

fn path_to_display_string(path: &Path) -> String {
    let path_str = path.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        path_str.replace('/', "\\")
    }
    #[cfg(not(target_os = "windows"))]
    {
        path_str
    }
}

/// 扫描过程中的一条"物理发现"记录：某个 id 在某个 source 处存在一份副本。
#[derive(Debug, Clone)]
struct SkillDiscovery {
    id: String,
    source: String, // "global" 或 agent name
    path: String,
    name: String,
    description: String,
    category: String,
    author: Option<String>,
    version: Option<String>,
    last_updated: String,
}

/// 解析 SKILL.md 的 YAML frontmatter，返回最小必要信息 + 发现条目。
fn parse_discovery(skill_md_path: &Path, source: &str) -> Result<SkillDiscovery, ScannerError> {
    let content = fs::read_to_string(skill_md_path)?;

    let frontmatter_re = Regex::new(r"(?s)^---[\r\n]+(.*?)[\r\n]+---").unwrap();
    let captures = frontmatter_re
        .captures(&content)
        .ok_or_else(|| ScannerError::InvalidFormat("Missing frontmatter".to_string()))?;

    let yaml_content = captures.get(1).unwrap().as_str();
    let yaml_map: serde_yaml::Value = serde_yaml::from_str(yaml_content)
        .map_err(|e| ScannerError::InvalidFormat(format!("YAML parse error: {}", e)))?;

    let get_str = |key: &str| -> Option<String> {
        yaml_map
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };

    let name = get_str("name").ok_or_else(|| ScannerError::MissingField("name".to_string()))?;
    let description = get_str("description")
        .ok_or_else(|| ScannerError::MissingField("description".to_string()))?;
    let category = get_str("category").unwrap_or_else(|| "Uncategorized".to_string());
    let author = get_str("author");
    let version = get_str("version");

    let skill_dir = skill_md_path.parent().unwrap();
    let id = skill_dir
        .file_name()
        .unwrap()
        .to_string_lossy()
        .to_string();

    let meta = fs::metadata(skill_md_path)?;
    let modified = meta.modified()?;
    let last_updated: String = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
        .to_string();

    let path = path_to_display_string(skill_dir);

    Ok(SkillDiscovery {
        id,
        source: source.to_string(),
        path,
        name,
        description,
        category,
        author,
        version,
        last_updated,
    })
}

/// 扫描某个目录下所有直接子目录的 SKILL.md（depth=2）。
fn walk_strict(base_path: &Path, source: &str) -> Vec<SkillDiscovery> {
    let mut out = Vec::new();
    if !base_path.exists() {
        return out;
    }

    for entry in WalkDir::new(base_path)
        .min_depth(2)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.file_name() != Some(std::ffi::OsStr::new("SKILL.md")) {
            continue;
        }
        match parse_discovery(path, source) {
            Ok(d) => out.push(d),
            Err(e) => eprintln!("Warning: Failed to parse {:?}: {}", path, e),
        }
    }
    out
}

/// 扫描"用户自定义"目录（base_path 的直接子目录），排除 plugins 与 symlink。
fn walk_user_custom(base_path: &Path, source: &str) -> Vec<SkillDiscovery> {
    let mut out = Vec::new();
    if !base_path.exists() {
        return out;
    }

    let Ok(entries) = fs::read_dir(base_path) else {
        return out;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if dir_name == "plugins" {
            continue;
        }
        if is_junction_or_symlink(&path) {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }
        match parse_discovery(&skill_md, source) {
            Ok(d) => out.push(d),
            Err(e) => eprintln!("Warning: Failed to parse {:?}: {}", skill_md, e),
        }
    }

    out
}

fn expand_tilde(path: &Path) -> Option<PathBuf> {
    let path_str = path.to_str()?;
    if let Some(rest) = path_str.strip_prefix("~/") {
        dirs::home_dir().map(|h| h.join(rest))
    } else {
        Some(path.to_path_buf())
    }
}

fn find_all_skills_dirs(base_path: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if !base_path.exists() {
        return out;
    }
    if let Ok(entries) = fs::read_dir(base_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if path.file_name() == Some(std::ffi::OsStr::new("skills")) {
                out.push(path);
            } else {
                out.extend(find_all_skills_dirs(&path));
            }
        }
    }
    out
}

/// 收集所有物理副本（按 id 分组，未合并）。
fn collect_discoveries() -> Vec<SkillDiscovery> {
    let mut all = Vec::new();

    // 1. 中央仓库
    if let Some(p) = expand_tilde(Path::new("~/.skills-manager/skills")) {
        all.extend(walk_strict(&p, SOURCE_GLOBAL));
    }

    // 2. 各 Agent 的用户自定义 skills 目录
    for (path_str, src) in &[
        ("~/.claude/skills", "claude"),
        ("~/.cursor/skills", "cursor"),
        ("~/.openclaw/skills", "openclaw"),
        ("~/.codex/skills", "codex"),
    ] {
        if let Some(p) = expand_tilde(Path::new(path_str)) {
            all.extend(walk_user_custom(&p, src));
        }
    }

    // 3. Cursor 内置 skills-cursor
    if let Some(p) = expand_tilde(Path::new("~/.cursor/skills-cursor")) {
        all.extend(walk_user_custom(&p, "cursor"));
    }

    // 4. Cursor 社区插件缓存
    if let Some(p) = expand_tilde(Path::new("~/.cursor/plugins/cache/cursor-public")) {
        for skills_path in find_all_skills_dirs(&p) {
            all.extend(walk_strict(&skills_path, "cursor"));
        }
    }

    // 5. Claude 插件缓存
    if let Some(p) = expand_tilde(Path::new("~/.claude/plugins/cache")) {
        for skills_path in find_all_skills_dirs(&p) {
            all.extend(walk_strict(&skills_path, "claude"));
        }
    }

    all
}

/// 检查 skill 是否被物理收录到任一 agent 目录中
fn check_skill_collected(skill_id: &str, agents: &[AgentConfig]) -> bool {
    let Some(home_dir) = dirs::home_dir() else {
        return false;
    };

    for agent in agents {
        let agent_path = if let Some(rest) = agent.path.strip_prefix("~/") {
            home_dir.join(rest)
        } else if let Some(rest) = agent.path.strip_prefix('~') {
            home_dir.join(rest)
        } else {
            home_dir.join(&agent.path)
        };
        let skill_in_agent = agent_path.join(&agent.skills_path).join(skill_id);
        if skill_in_agent.is_dir() && !skill_in_agent.is_symlink() {
            return true;
        }
    }
    false
}

/// 扫描所有源并合并：每个 skill_id 返回一条 `SkillMetadata`。
///
/// 副作用：会把"物理扫到但 skill_states 里没记录"的 source 补进 `SkillEntry.sources`（自愈）；
/// 同样会把"skill_states 里有但物理已消失"的 source 从条目中清理掉，并删除孤儿记录。
pub fn scan_and_merge(
    skill_states: &mut HashMap<String, SkillEntry>,
    agents: &[AgentConfig],
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let discoveries = collect_discoveries();

    // 按 id 分组
    let mut by_id: HashMap<String, Vec<SkillDiscovery>> = HashMap::new();
    for d in discoveries {
        by_id.entry(d.id.clone()).or_default().push(d);
    }

    // 所有已知 Agent 名（用于派生 agent_enabled）
    let agent_names: Vec<String> = agents.iter().map(|a| a.name.clone()).collect();

    // 1) 自愈：把物理副本位置同步进 skill_states
    for (id, group) in &by_id {
        let entry = skill_states.entry(id.clone()).or_default();
        for d in group {
            entry.insert_source(&d.source);
        }
        // 移除 sources 里已不存在物理副本的项
        let existing: std::collections::HashSet<&str> =
            group.iter().map(|d| d.source.as_str()).collect();
        entry.sources.retain(|s| existing.contains(s.as_str()));
        entry.ensure_valid_primary();
    }

    // 2) 删除孤儿：skill_states 里但本次扫描完全没发现物理副本的 id
    skill_states.retain(|id, entry| {
        if by_id.contains_key(id) {
            true
        } else {
            entry.sources.clear();
            false
        }
    });

    // 3) 构造返回的 SkillMetadata（每个 id 一条，用 primary 的元数据做展示基）
    let mut result = Vec::with_capacity(by_id.len());
    for (id, group) in by_id {
        let entry = skill_states
            .get(&id)
            .cloned()
            .unwrap_or_else(|| SkillEntry {
                sources: group.iter().map(|d| d.source.clone()).collect(),
                primary: pick_default_primary(
                    &group.iter().map(|d| d.source.clone()).collect::<Vec<_>>(),
                )
                .unwrap_or_default(),
                open: Vec::new(),
            });

        let primary_discovery = group
            .iter()
            .find(|d| d.source == entry.primary)
            .or_else(|| group.first())
            .unwrap();

        let source_paths: HashMap<String, String> = group
            .iter()
            .map(|d| (d.source.clone(), d.path.clone()))
            .collect();

        let agent_enabled = entry.derive_agent_enabled(&agent_names);
        let enabled = agent_enabled.values().any(|v| *v);
        let is_collected =
            entry.sources.iter().any(|s| s == SOURCE_GLOBAL) && check_skill_collected(&id, agents);

        // primary 上缺失的字段从其他源 fallback（例如 primary 的 description 为空）
        let pick_str = |f: &dyn Fn(&SkillDiscovery) -> &str| -> String {
            let p = f(primary_discovery);
            if !p.is_empty() {
                return p.to_string();
            }
            group
                .iter()
                .find(|d| !f(d).is_empty())
                .map(|d| f(d).to_string())
                .unwrap_or_default()
        };
        let pick_opt = |f: &dyn Fn(&SkillDiscovery) -> Option<&str>| -> Option<String> {
            if let Some(s) = f(primary_discovery) {
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
            group
                .iter()
                .find_map(|d| f(d).filter(|s| !s.is_empty()).map(|s| s.to_string()))
        };

        result.push(SkillMetadata {
            id: id.clone(),
            name: pick_str(&|d| d.name.as_str()),
            description: pick_str(&|d| d.description.as_str()),
            category: pick_str(&|d| d.category.as_str()),
            author: pick_opt(&|d| d.author.as_deref()),
            version: pick_opt(&|d| d.version.as_deref()),
            enabled,
            agent_enabled,
            installed_at: primary_discovery.last_updated.clone(),
            last_updated: primary_discovery.last_updated.clone(),
            is_collected,
            sources: entry.sources.clone(),
            primary: entry.primary.clone(),
            open: entry.open.clone(),
            source_paths,
        });
    }

    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}

/// 向后兼容的只读入口：对外保持原签名，但内部复用 `scan_and_merge`。
/// 由于 `scan_and_merge` 会修改 `skill_states`，这里在只读场景下对其做 clone。
pub fn scan_all_skill_sources(
    skill_states: &HashMap<String, SkillEntry>,
    agents: &[AgentConfig],
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut cloned = skill_states.clone();
    scan_and_merge(&mut cloned, agents)
}

#[cfg(test)]
mod tests {}
