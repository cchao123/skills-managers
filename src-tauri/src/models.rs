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
        }
    }
}

// ========== 旧模型保留用于向后兼容 ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
#[allow(dead_code)]
pub struct LegacySkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub plugin_name: String,
    pub plugin_version: String,
    pub path: String,
    pub enabled: bool,
    pub agent_disabled: HashMap<String, bool>,
    pub installed_at: String,
    pub source: LegacySkillSource,
    pub repository: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum LegacySkillSource {
    Marketplace,
    GitHub,
    Local,
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
    pub path: String,
    pub enabled: bool,
    pub last_sync: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ClaudeSettings {
    pub enabled_plugins: Option<HashMap<String, bool>>,
    #[serde(flatten)]
    pub other: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
#[allow(dead_code)]
pub struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
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

/// GitHub 技能信息（用于 Marketplace）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSkill {
    /// 技能 ID (格式: "owner/repo")
    pub id: String,
    /// 技能名称
    pub name: String,
    /// 技能描述
    pub description: String,
    /// 分类
    pub category: String,
    /// 作者
    pub author: String,
    /// 版本（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Stars 数量
    pub stars: i64,
    /// 仓库 URL
    pub repository: String,
    /// 默认分支
    pub default_branch: String,
    /// 最后更新时间
    pub updated_at: String,
    /// 安装状态
    pub install_status: InstallStatus,
    /// 已启用的 Agent 列表
    #[serde(default)]
    pub enabled_agents: Vec<String>,
}

/// 安装状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InstallStatus {
    /// 已安装并启用
    Installed,
    /// 已下载但未启用
    Downloaded,
    /// 未安装
    Available,
}
