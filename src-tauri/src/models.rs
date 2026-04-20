use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ========== Phase 1 新模型 ==========

/// 技能来源
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, Default)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    #[default]
    Global,   // ~/.skills-manager/skills/
    Cursor,   // ~/.cursor/skills/
    Claude,   // ~/.claude/plugins/cache/
    OpenClaw, // ~/.openclaw/skills/
    Codex,    // ~/.codex/skills/
}

/// 技能元数据 - Phase 1 新模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    pub enabled: bool,
    #[serde(default)]
    pub agent_enabled: HashMap<String, bool>,
    /// 备份的agent状态（在关闭总开关时保存）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_enabled_backup: Option<HashMap<String, bool>>,
    pub installed_at: String,
    pub last_updated: String,
    /// 技能来源（用于智能默认状态）
    #[serde(default)]
    pub source: SkillSource,
    /// 是否已被物理收录到 Agent 的 skills 目录中（非 symlink）
    #[serde(default)]
    pub is_collected: bool,
    /// 技能的完整文件系统路径（用于创建符号链接）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// Agent 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub display_name: String,
    pub path: String,
    pub skills_path: String,
    pub enabled: bool,
    pub detected: bool,
}

impl SkillSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            SkillSource::Global => "global",
            SkillSource::Cursor => "cursor",
            SkillSource::Claude => "claude",
            SkillSource::OpenClaw => "openclaw",
            SkillSource::Codex => "codex",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s {
            "global" => Some(SkillSource::Global),
            "cursor" => Some(SkillSource::Cursor),
            "claude" => Some(SkillSource::Claude),
            "openclaw" => Some(SkillSource::OpenClaw),
            "codex" => Some(SkillSource::Codex),
            _ => None,
        }
    }
}

/// 生成 skill_states 的复合键：`source:skill_id`
pub fn skill_state_key(source: &SkillSource, id: &str) -> String {
    format!("{}:{}", source.as_str(), id)
}

/// 从 skill_states 中读取状态，优先复合键，fallback 旧键（向后兼容）
pub fn get_skill_state<'a>(
    skill_states: &'a HashMap<String, HashMap<String, bool>>,
    source: &SkillSource,
    id: &str,
) -> Option<&'a HashMap<String, bool>> {
    let composite = skill_state_key(source, id);
    skill_states.get(&composite).or_else(|| skill_states.get(id))
}

/// 链接策略
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LinkStrategy {
    Symlink,
    Copy,
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub linking_strategy: LinkStrategy,
    pub agents: Vec<AgentConfig>,
    #[serde(default)]
    pub skill_states: HashMap<String, HashMap<String, bool>>, // skill_id -> {agent_name -> enabled}
    #[serde(default = "default_language")]
    pub language: String,
    /// 按前缀隐藏 skill 的规则（大小写不敏感）。前端与托盘菜单共享该列表。
    #[serde(default)]
    pub skill_hide_prefixes: Vec<String>,
}

fn default_language() -> String {
    let lang = std::env::var("LANG").unwrap_or_default();
    if lang.starts_with("zh") { "zh".to_string() } else { "en".to_string() }
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            linking_strategy: LinkStrategy::Symlink,
            agents: vec![],
            skill_states: HashMap::new(),
            language: default_language(),
            skill_hide_prefixes: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitHubConfig {
    pub repositories: HashMap<String, GitHubRepoConfig>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitHubRepoConfig {
    pub owner: String,
    pub repo: String,
    pub branch: String,
    pub token: Option<String>,
    pub last_sync: Option<String>,
}

/// 技能文件条目（用于文件树）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub children: Option<Vec<SkillFileEntry>>,
}

