use crate::models::{Frontmatter, LegacySkillMetadata, SkillMetadata, LegacySkillSource, SkillSource};
use anyhow::{Context, Result};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use thiserror::Error;
use walkdir::WalkDir;

// ========== Phase 1 新 Scanner 实现 ==========

#[derive(Debug, Error)]
pub enum ScannerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid SKILL.md format: {0}")]
    InvalidFormat(String),

    #[error("Missing required field: {0}")]
    MissingField(String),
}

/// 解析 SKILL.md 文件的 YAML frontmatter (Phase 1 新版本)
pub fn parse_skill_md(skill_md_path: &Path, source: SkillSource) -> Result<SkillMetadata, ScannerError> {
    let content = fs::read_to_string(skill_md_path)?;

    // 提取 YAML frontmatter (--- 包围的部分)
    // 使用 (?s) 使 . 匹配换行符，使用 [\r\n]? 匹配可选的 CR
    let frontmatter_re = Regex::new(r"(?s)^---[\r\n]+(.*?)[\r\n]+---").unwrap();
    let captures = frontmatter_re.captures(&content)
        .ok_or_else(|| ScannerError::InvalidFormat("Missing frontmatter".to_string()))?;

    let yaml_content = captures.get(1).unwrap().as_str();

    let yaml_map: serde_yaml::Value = serde_yaml::from_str(yaml_content)
        .map_err(|e| ScannerError::InvalidFormat(format!("YAML parse error: {}", e)))?;

    let get_str = |key: &str| -> Option<String> {
        yaml_map.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
    };

    let name = get_str("name")
        .ok_or_else(|| ScannerError::MissingField("name".to_string()))?;
    let description = get_str("description")
        .ok_or_else(|| ScannerError::MissingField("description".to_string()))?;
    let category = get_str("category").unwrap_or_else(|| "Uncategorized".to_string());
    let author: Option<String> = get_str("author");
    let version: Option<String> = get_str("version");

    // 生成唯一 ID
    let skill_dir = skill_md_path.parent().unwrap();
    let id = skill_dir.file_name()
        .unwrap()
        .to_string_lossy()
        .to_string();

    // 获取文件修改时间
    let metadata = fs::metadata(skill_md_path)?;
    let modified = metadata.modified()?;
    let last_updated: String = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    // 保存技能目录的完整路径
    let skill_path = skill_dir.to_string_lossy().to_string();

    Ok(SkillMetadata {
        id,
        name,
        description,
        category,
        author,
        version,
        repository: None,
        enabled: true,
        agent_enabled: HashMap::new(), // 将在外部填充
        agent_enabled_backup: None,
        installed_at: last_updated.clone(),
        last_updated,
        source,
        is_collected: false,
        path: Some(skill_path),
    })
}

/// 扫描技能目录，返回所有找到的技能 (Phase 1 新版本)
pub fn scan_skills_directory(
    base_path: &Path,
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    source: SkillSource,
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut skills = Vec::new();
    let mut seen_ids = HashSet::new();

    if !base_path.exists() {
        return Ok(skills);
    }

    for entry in WalkDir::new(base_path)
        .min_depth(2)  // 至少深度为 2：base_path/skill-name/SKILL.md
        .max_depth(2)  // 最多深度为 2：只扫描直接子目录
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // 只处理 SKILL.md 文件
        if path.file_name() != Some(std::ffi::OsStr::new("SKILL.md")) {
            continue;
        }

        match parse_skill_md(path, source.clone()) {
            Ok(mut skill) => {
                // 填充 agent_enabled 状态
                if let Some(states) = skill_states.get(&skill.id) {
                    // 优先使用配置文件中的状态
                    skill.agent_enabled = states.clone();
                    eprintln!("Loaded agent states for skill {}: {:?}", skill.id, skill.agent_enabled);
                } else {
                    // 如果配置文件中没有该技能，根据来源设置默认状态
                    skill.agent_enabled = get_default_agent_states(&skill.source);
                    eprintln!("Set default agent states for skill {} (source: {:?}): {:?}", skill.id, skill.source, skill.agent_enabled);
                }

                if !seen_ids.contains(&skill.id) {
                    seen_ids.insert(skill.id.clone());
                    skills.push(skill);
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to parse {:?}: {}", path, e);
            }
        }
    }

    skills.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(skills)
}

/// 根据技能来源获取默认的agent启用状态
fn get_default_agent_states(source: &SkillSource) -> HashMap<String, bool> {
    let mut states = HashMap::new();

    match source {
        SkillSource::Global => {
            // 中央存储的技能：默认所有agent都启用（用户可手动控制）
            states.insert("claude".to_string(), true);
            states.insert("cursor".to_string(), true);
        }
        SkillSource::Cursor => {
            // Cursor来源的技能：默认只对Cursor启用
            states.insert("cursor".to_string(), true);
            states.insert("claude".to_string(), false);
        }
        SkillSource::Claude => {
            // Claude来源的技能：默认只对Claude启用
            states.insert("claude".to_string(), true);
            states.insert("cursor".to_string(), false);
        }
    }

    states
}

/// 扫描用户自定义技能目录（排除子目录）
/// 用于扫描 ~/.claude/skills/ 和 ~/.cursor/skills/ 下的用户自定义技能
/// 但排除 plugins/ 等符号链接目录
pub fn scan_user_custom_skills(
    base_path: &Path,
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    source: SkillSource,
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut skills = Vec::new();
    let mut seen_ids = HashSet::new();

    if !base_path.exists() {
        return Ok(skills);
    }

    eprintln!("=== Scanning user custom skills from: {:?} ===", base_path);

    // 直接扫描 base_path 下的直接子目录
    if let Ok(entries) = std::fs::read_dir(base_path) {
        for entry in entries.flatten() {
            let path = entry.path();

            // 只处理目录
            if !path.is_dir() {
                continue;
            }

            // 排除特定目录（符号链接目录）
            let dir_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            // 排除 plugins 目录（这是我们管理的符号链接目录）
            if dir_name == "plugins" {
                eprintln!("Skipping plugins directory: {:?}", path);
                continue;
            }

            // 检查是否有 SKILL.md
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }

            // 解析技能
            match parse_skill_md(&skill_md, source.clone()) {
                Ok(mut skill) => {
                    // 填充 agent_enabled 状态
                    if let Some(states) = skill_states.get(&skill.id) {
                        skill.agent_enabled = states.clone();
                        eprintln!("Loaded agent states for skill {}: {:?}", skill.id, skill.agent_enabled);
                    } else {
                        skill.agent_enabled = get_default_agent_states(&skill.source);
                        eprintln!("Set default agent states for skill {} (source: {:?}): {:?}",
                            skill.id, skill.source, skill.agent_enabled);
                    }

                    if !seen_ids.contains(&skill.id) {
                        let skill_id = skill.id.clone();
                        seen_ids.insert(skill_id.clone());
                        skills.push(skill);
                        eprintln!("✅ Found user custom skill: {}", skill_id);
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to parse {:?}: {}", path, e);
                }
            }
        }
    }

    eprintln!("Found {} user custom skills", skills.len());
    Ok(skills)
}

/// 扫描多个源的技能目录，返回所有找到的技能
pub fn scan_all_skill_sources(
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    agents: &[crate::models::AgentConfig],
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut all_skills = Vec::new();
    let mut seen_ids: HashSet<(String, SkillSource)> = HashSet::new();

    // 1. 扫描中央存储（优先级最高）
    let central_path = std::path::PathBuf::from("~/.skills-manager/skills");
    if let Ok(expanded) = expand_tilde(&central_path) {
        eprintln!("=== Scanning central storage: {:?} ===", expanded);
        if let Ok(skills) = scan_skills_directory(&expanded, skill_states, SkillSource::Global) {
            for skill in skills {
                let key = (skill.id.clone(), SkillSource::Global);
                if !seen_ids.contains(&key) {
                    seen_ids.insert(key.clone());
                    all_skills.push(skill);
                    eprintln!("✅ Added central storage skill: {}", key.0);
                }
            }
        }
    }

    // 2. 扫描 Claude 用户自定义技能目录
    let claude_custom_path = std::path::PathBuf::from("~/.claude/skills");
    if let Ok(expanded) = expand_tilde(&claude_custom_path) {
        if let Ok(skills) = scan_user_custom_skills(&expanded, skill_states, SkillSource::Claude) {
            for skill in skills {
                let key = (skill.id.clone(), SkillSource::Claude);
                if !seen_ids.contains(&key) {
                    seen_ids.insert(key.clone());
                    all_skills.push(skill);
                    eprintln!("✅ Added Claude custom skill: {}", key.0);
                }
            }
        }
    }

    // 3. 扫描 Cursor 用户自定义技能目录
    let cursor_custom_path = std::path::PathBuf::from("~/.cursor/skills");
    if let Ok(expanded) = expand_tilde(&cursor_custom_path) {
        if let Ok(skills) = scan_user_custom_skills(&expanded, skill_states, SkillSource::Cursor) {
            for skill in skills {
                let key = (skill.id.clone(), SkillSource::Cursor);
                if !seen_ids.contains(&key) {
                    seen_ids.insert(key.clone());
                    all_skills.push(skill);
                    eprintln!("✅ Added Cursor custom skill: {}", key.0);
                }
            }
        }
    }

    // 4. 扫描 Cursor 内置技能目录 (~/.cursor/skills-cursor/)
    let cursor_builtin_path = std::path::PathBuf::from("~/.cursor/skills-cursor");
    if let Ok(expanded) = expand_tilde(&cursor_builtin_path) {
        eprintln!("=== Scanning Cursor built-in skills from: {:?} ===", expanded);
        if let Ok(skills) = scan_user_custom_skills(&expanded, skill_states, SkillSource::Cursor) {
            for skill in skills {
                let key = (skill.id.clone(), SkillSource::Cursor);
                if !seen_ids.contains(&key) {
                    seen_ids.insert(key.clone());
                    all_skills.push(skill);
                    eprintln!("✅ Added Cursor built-in skill: {}", key.0);
                }
            }
        }
    }

    // 5. 扫描 Cursor 社区/商店插件缓存 (~/.cursor/plugins/cache/cursor-public/)
    let cursor_plugins_path = std::path::PathBuf::from("~/.cursor/plugins/cache/cursor-public");
    if let Ok(expanded) = expand_tilde(&cursor_plugins_path) {
        eprintln!("=== Scanning Cursor community plugins from: {:?} ===", expanded);
        let skills_dirs = find_all_skills_dirs(&expanded);
        eprintln!("Found {} skills directories in Cursor plugins", skills_dirs.len());

        for skills_path in skills_dirs {
            eprintln!("Scanning: {:?}", skills_path);
            if let Ok(skills) = scan_skills_directory(&skills_path, skill_states, SkillSource::Cursor) {
                eprintln!("Found {} skills from Cursor plugin", skills.len());
                for skill in skills {
                    eprintln!("  - Skill: {} (source: Cursor)", skill.name);
                    let key = (skill.id.clone(), SkillSource::Cursor);
                    if !seen_ids.contains(&key) {
                        seen_ids.insert(key);
                        all_skills.push(skill);
                    }
                }
            }
        }
    }
    eprintln!("=== Cursor plugin scan complete, total skills so far: {} ===", all_skills.len());

    // 扫描Claude插件缓存
    let claude_plugins_path = std::path::PathBuf::from("~/.claude/plugins/cache");
    eprintln!("=== Scanning Claude plugins from: {:?} ===", claude_plugins_path);
    if let Ok(expanded) = expand_tilde(&claude_plugins_path) {
        eprintln!("Expanded path: {:?}", expanded);
        eprintln!("Path exists: {}", expanded.exists());

        // 直接递归查找所有skills目录
        let skills_dirs = find_all_skills_dirs(&expanded);
        eprintln!("Found {} skills directories in Claude plugins", skills_dirs.len());

        for skills_path in skills_dirs {
            eprintln!("Scanning: {:?}", skills_path);
            if let Ok(skills) = scan_skills_directory(&skills_path, skill_states, SkillSource::Claude) {
                eprintln!("Found {} skills from Claude plugin", skills.len());
                for skill in skills {
                    eprintln!("  - Skill: {} (source: Claude)", skill.name);
                    let key = (skill.id.clone(), SkillSource::Claude);
                    if !seen_ids.contains(&key) {
                        seen_ids.insert(key);
                        all_skills.push(skill);
                    }
                }
            }
        }
    } else {
        eprintln!("Failed to expand Claude plugins path");
    }
    eprintln!("=== Claude plugin scan complete, total skills so far: {} ===", all_skills.len());

    // 计算 is_collected 状态（仅对 Central 来源有意义）
    for skill in &mut all_skills {
        if skill.source == SkillSource::Global {
            skill.is_collected = check_skill_collected(&skill.id, agents);
        }
    }

    all_skills.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(all_skills)
}

/// 检查路径是否为物理目录（非符号链接）
fn is_physical_dir(path: &std::path::Path) -> bool {
    path.is_dir() && !path.is_symlink()
}

/// 检查 skill 是否被物理收录到任一 agent 目录中
fn check_skill_collected(skill_id: &str, agents: &[crate::models::AgentConfig]) -> bool {
    let home_dir = match dirs::home_dir() {
        Some(h) => h,
        None => return false,
    };

    for agent in agents {
        let agent_path = if agent.path.starts_with("~/") {
            home_dir.join(&agent.path[2..])
        } else if agent.path.starts_with("~") {
            home_dir.join(&agent.path[1..])
        } else {
            home_dir.join(&agent.path)
        };

        let skill_in_agent = agent_path.join(&agent.skills_path).join(skill_id);
        if is_physical_dir(&skill_in_agent) {
            return true;
        }
    }
    false
}

/// 展开~前缀为home目录
fn expand_tilde(path: &Path) -> Result<PathBuf, ScannerError> {
    let path_str = path.to_str().unwrap_or("");
    if path_str.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            let rest = &path_str[2..];
            return Ok(home.join(rest));
        }
    }
    Ok(path.to_path_buf())
}

/// 递归查找所有skills目录
fn find_all_skills_dirs(base_path: &Path) -> Vec<PathBuf> {
    let mut skills_dirs = Vec::new();

    // 递归遍历目录
    if let Ok(entries) = std::fs::read_dir(base_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 如果是skills目录，拷贝到结果
                if path.file_name() == Some(std::ffi::OsStr::new("skills")) {
                    eprintln!("Found skills directory: {:?}", path);
                    skills_dirs.push(path);
                } else {
                    // 否则递归查找
                    let sub_dirs = find_all_skills_dirs(&path);
                    skills_dirs.extend(sub_dirs);
                }
            }
        }
    }

    skills_dirs
}

// ========== 旧 Scanner 实现 (保留用于向后兼容) ==========

#[allow(dead_code)]
pub struct SkillScanner {
    claude_home: PathBuf,
}

#[allow(dead_code)]
impl SkillScanner {
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .context("Failed to get home directory")?;
        let claude_home = home.join(".claude");
        Ok(Self { claude_home })
    }

    pub fn scan_all(&self) -> Result<Vec<LegacySkillMetadata>> {
        let mut skills = Vec::new();

        // Scan marketplace skills
        let marketplace_skills = self.scan_marketplace_skills()?;
        skills.extend(marketplace_skills);

        // Scan GitHub skills
        let github_skills = self.scan_github_skills()?;
        skills.extend(github_skills);

        Ok(skills)
    }

    fn scan_marketplace_skills(&self) -> Result<Vec<LegacySkillMetadata>> {
        let mut skills = Vec::new();
        let plugins_cache = self.claude_home.join("plugins/cache");

        if !plugins_cache.exists() {
            return Ok(skills);
        }

        for entry in fs::read_dir(plugins_cache)? {
            let marketplace = entry?;
            let marketplace_path = marketplace.path();

            for plugin_entry in fs::read_dir(&marketplace_path)? {
                let plugin = plugin_entry?;
                let plugin_path = plugin.path();
                let plugin_name = plugin_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Find skills directory
                let skills_dir = plugin_path.join("skills");
                if !skills_dir.exists() {
                    continue;
                }

                // Scan each skill
                for skill_entry in fs::read_dir(&skills_dir)? {
                    let skill = skill_entry?;
                    let skill_path = skill.path();

                    let skill_md = skill_path.join("SKILL.md");
                    if skill_md.exists() {
                        if let Some(metadata) = self.parse_skill_md(&skill_md, &plugin_name, &skill_path, LegacySkillSource::Marketplace)? {
                            skills.push(metadata);
                        }
                    }
                }
            }
        }

        Ok(skills)
    }

    fn scan_github_skills(&self) -> Result<Vec<LegacySkillMetadata>> {
        let mut skills = Vec::new();
        let skills_manager_dir = self.claude_home.join("skills-manager");

        if !skills_manager_dir.exists() {
            return Ok(skills);
        }

        for repo_entry in fs::read_dir(&skills_manager_dir)? {
            let repo = repo_entry?;
            let repo_path = repo.path();
            let repo_name = repo_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let skills_dir = repo_path.join("skills");
            if !skills_dir.exists() {
                continue;
            }

            for skill_entry in fs::read_dir(&skills_dir)? {
                let skill = skill_entry?;
                let skill_path = skill.path();

                let skill_md = skill_path.join("SKILL.md");
                if skill_md.exists() {
                    if let Some(metadata) = self.parse_skill_md(&skill_md, &repo_name, &skill_path, LegacySkillSource::GitHub)? {
                        let mut metadata = metadata;
                        metadata.repository = Some(repo_name.clone());
                        skills.push(metadata);
                    }
                }
            }
        }

        Ok(skills)
    }

    fn parse_skill_md(
        &self,
        skill_md: &PathBuf,
        plugin_name: &str,
        skill_path: &PathBuf,
        source: LegacySkillSource,
    ) -> Result<Option<LegacySkillMetadata>> {
        let content = fs::read_to_string(skill_md)?;
        let frontmatter = self.extract_frontmatter(&content)?;

        let name = frontmatter.name.unwrap_or_else(|| {
            skill_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string()
        });

        let description = frontmatter.description.unwrap_or_else(|| "No description".to_string());

        // Extract version from path (e.g., /.../5.0.6/skills/...)
        let version = skill_path
            .ancestors()
            .find(|p| p.file_name().and_then(|n| n.to_str()).map_or(false, |s| s.chars().all(|c| c.is_digit(10) || c == '.')))
            .and_then(|p| p.file_name().and_then(|n| n.to_str()))
            .unwrap_or("unknown")
            .to_string();

        let id = format!("{}@{}/{}", plugin_name, version, name);
        let path_str = skill_path.to_string_lossy().to_string();

        Ok(Some(LegacySkillMetadata {
            id,
            name,
            description,
            plugin_name: plugin_name.to_string(),
            plugin_version: version,
            path: path_str,
            enabled: true, // Default to enabled, will be updated by settings
            agent_disabled: HashMap::new(),
            installed_at: self.get_file_modified_time(skill_md)?,
            source,
            repository: None,
        }))
    }

    fn extract_frontmatter(&self, content: &str) -> Result<Frontmatter> {
        // Parse YAML frontmatter between --- markers
        let re = Regex::new(r"^---\s*\n([\s\S]*?)\n---")?;
        let caps = re.captures(content);

        if let Some(caps) = caps {
            let yaml_content = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let frontmatter: Frontmatter = serde_yaml::from_str(yaml_content)?;
            Ok(frontmatter)
        } else {
            Ok(Frontmatter {
                name: None,
                description: None,
            })
        }
    }

    fn get_file_modified_time(&self, path: &PathBuf) -> Result<String> {
        let metadata = fs::metadata(path)?;
        let modified = metadata.modified()?;
        Ok(format!("{:?}", modified))
    }
}

impl Default for SkillScanner {
    fn default() -> Self {
        Self::new().expect("Failed to create SkillScanner")
    }
}

#[cfg(test)]
mod tests {
}
