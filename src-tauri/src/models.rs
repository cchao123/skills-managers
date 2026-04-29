use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ========== Phase 1 新模型 ==========

/// 技能元数据（返回给前端）
///
/// Schema v2：scanner 把同 id 不同源的物理副本合并为 **一条** `SkillMetadata`：
/// - `agent_enabled` 由 `sources`（原生自动开启）+ `open`（用户主动链接）派生
/// - `sources`/`primary`/`open`/`source_paths` 描述多源布局
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
    pub enabled: bool,
    #[serde(default)]
    pub agent_enabled: HashMap<String, bool>,
    pub installed_at: String,
    pub last_updated: String,
    /// 是否已被物理收录到 Agent 的 skills 目录中（非 symlink）
    #[serde(default)]
    pub is_collected: bool,

    /// 物理副本所在位置。`"global"` 代表中央仓库，其它都是 Agent 名。
    #[serde(default)]
    pub sources: Vec<String>,
    /// 跨链接时默认使用哪份物理副本为源。必须在 `sources` 里。
    #[serde(default)]
    pub primary: String,
    /// 用户主动要求链接到的非原生 Agent 列表。
    #[serde(default)]
    pub open: Vec<String>,
    /// 每个 source 对应的物理路径（供"查看来源"之类的功能用）。
    #[serde(default)]
    pub source_paths: HashMap<String, String>,
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
    /// 额外的安装根目录（如 trae-cn 的 ~/.trae-cn）。
    /// 检测时只要主路径或任一 extra_paths 存在即视为"已安装"。
    /// 扫描时会对主路径和所有 extra_paths 均执行 skills_path 子目录扫描。
    #[serde(default)]
    pub extra_paths: Vec<String>,
}

/// 代表中央仓库（`~/.skills-manager/skills/`）的特殊 source 标识。
pub const SOURCE_GLOBAL: &str = "global";

/// Schema v2 的技能状态条目。
///
/// 一个 skill_id 对应一条记录，包含：
/// - `sources`: 哪些位置有物理副本（`"global"` 或 agent 名）
/// - `primary`: 链接到非原生 Agent 时用哪份副本为源
/// - `open`: 用户主动启用的非原生 Agent 列表
///
/// 原生 Agent（在 `sources` 里但不等于 `"global"`）自动视为"已启用"，
/// 无需也不应出现在 `open` 中。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SkillEntry {
    #[serde(default)]
    pub sources: Vec<String>,
    #[serde(default)]
    pub primary: String,
    #[serde(default)]
    pub open: Vec<String>,
}

impl SkillEntry {
    /// 生成便于 UI 使用的 `agent_enabled` 映射：原生 Agent + open 列表里的 Agent 为 true，其余 false。
    pub fn derive_agent_enabled(&self, all_agents: &[String]) -> HashMap<String, bool> {
        let native: std::collections::HashSet<&str> = self
            .sources
            .iter()
            .filter(|s| s.as_str() != SOURCE_GLOBAL)
            .map(|s| s.as_str())
            .collect();
        let open: std::collections::HashSet<&str> = self.open.iter().map(|s| s.as_str()).collect();

        all_agents
            .iter()
            .map(|agent| {
                let enabled = native.contains(agent.as_str()) || open.contains(agent.as_str());
                (agent.clone(), enabled)
            })
            .collect()
    }

    /// 是否有任意一份物理副本（用于清理孤儿记录）。
    pub fn is_orphan(&self) -> bool {
        self.sources.is_empty()
    }

    /// 把某个 source（物理副本位置）并入 `sources`，幂等。
    pub fn insert_source(&mut self, source: &str) {
        if !self.sources.iter().any(|s| s == source) {
            self.sources.push(source.to_string());
        }
    }

    /// 修复 `primary`：若为空或不在 `sources` 中，自动按优先级选择。
    pub fn ensure_valid_primary(&mut self) {
        if !self.primary.is_empty() && self.sources.iter().any(|s| s == &self.primary) {
            return;
        }
        self.primary = pick_default_primary(&self.sources).unwrap_or_default();
    }
}

/// 按优先级 `global > claude > cursor > openclaw > codex > ...` 选默认主源。
pub fn pick_default_primary(sources: &[String]) -> Option<String> {
    fn priority(s: &str) -> u32 {
        match s {
            SOURCE_GLOBAL => 0,
            "claude" => 1,
            "cursor" => 2,
            "openclaw" => 3,
            "codex" => 4,
            _ => 100,
        }
    }
    sources
        .iter()
        .min_by_key(|s| (priority(s.as_str()), s.as_str().to_string()))
        .cloned()
}

/// 链接策略
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LinkStrategy {
    Symlink,
    Copy,
}

/// 当前配置文件的 schema 版本。任何变更数据形状的改动都应 bump 此值。
/// 启动时若发现 `AppConfig.schema_version` 与本常量不一致（或缺失），
/// 会重置 `skill_states` 让 scanner 自愈重建。
pub const CURRENT_SCHEMA_VERSION: &str = "v1";

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 数据格式版本（字符串，形如 "v1"）。若加载时与 `CURRENT_SCHEMA_VERSION` 不符，
    /// `AppSettingsManager::load_or_create` 会丢弃 `skill_states` 按当前代码重建。
    #[serde(default)]
    pub schema_version: String,
    pub linking_strategy: LinkStrategy,
    pub agents: Vec<AgentConfig>,
    /// skill_id -> SkillEntry
    #[serde(default)]
    pub skill_states: HashMap<String, SkillEntry>,
    #[serde(default = "default_language")]
    pub language: String,
    /// 按前缀隐藏 skill 的规则（大小写不敏感）。前端与托盘菜单共享该列表。
    #[serde(default)]
    pub skill_hide_prefixes: Vec<String>,
    /// 用户在 Dashboard 中"置顶"的 skill_id 列表。前端据此把这些卡片排在最前面。
    #[serde(default)]
    pub pinned_skills: Vec<String>,
}

fn default_language() -> String {
    let lang = std::env::var("LANG").unwrap_or_default();
    if lang.starts_with("zh") { "zh".to_string() } else { "en".to_string() }
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            schema_version: CURRENT_SCHEMA_VERSION.to_string(),
            linking_strategy: LinkStrategy::Symlink,
            agents: vec![],
            skill_states: HashMap::new(),
            language: default_language(),
            skill_hide_prefixes: Vec::new(),
            pinned_skills: Vec::new(),
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

