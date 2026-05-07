use crate::models::{AgentConfig, AppConfig, LinkStrategy, CURRENT_SCHEMA_VERSION};
use std::fs;
use std::path::{Path, PathBuf};

/// 原子写：先写临时文件，再 rename，避免写入中途崩溃导致文件损坏。
fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, path)
}
use thiserror::Error;

// ========== App Settings Manager (Phase 1) ==========

#[derive(Debug, Error)]
pub enum AppSettingsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Agent already exists: {0}")]
    AgentAlreadyExists(String),
}

/// 应用配置管理器 - 管理 ~/.skills-manager/config.json
pub struct AppSettingsManager {
    config_path: PathBuf,
    config: AppConfig,
}

impl AppSettingsManager {
    /// 加载或创建配置文件。
    ///
    /// 版本兼容策略：
    /// - 文件不存在 → 用默认配置（含 `schema_version = CURRENT_SCHEMA_VERSION`）并写盘
    /// - 文件存在但 `schema_version` 与当前不符（或缺失）→ 保留 `linking_strategy`、`agents`、
    ///   `language`、`skill_hide_prefixes`，**丢弃 `skill_states`** 让 scanner 自愈重建；
    ///   同时把 `schema_version` 写成当前值并立即持久化。
    /// 所有前端已知 agent 的规范定义，顺序与前端 KNOWN_AGENTS 保持一致。
    /// 新增 agent 时同步更新此列表。
    fn known_agent_presets() -> Vec<AgentConfig> {
        vec![
            AgentConfig { name: "claude".to_string(),      display_name: "Claude Code".to_string(), path: "~/.claude".to_string(),      skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "cursor".to_string(),      display_name: "Cursor".to_string(),      path: "~/.cursor".to_string(),      skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "codex".to_string(),       display_name: "Codex".to_string(),       path: "~/.codex".to_string(),       skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "openclaw".to_string(),    display_name: "OpenClaw".to_string(),    path: "~/.openclaw".to_string(),    skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "opencode".to_string(),    display_name: "OpenCode".to_string(),    path: "~/.opencode".to_string(),    skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "trae".to_string(),        display_name: "Trae".to_string(),        path: "~/.trae".to_string(),        skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "qoder".to_string(),       display_name: "Qoder".to_string(),       path: "~/.qoder".to_string(),       skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "antigravity".to_string(), display_name: "Antigravity".to_string(), path: "~/.antigravity".to_string(), skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
            AgentConfig { name: "kiro".to_string(),        display_name: "Kiro".to_string(),        path: "~/.kiro".to_string(),        skills_path: "skills".to_string(), enabled: true, detected: false, extra_paths: vec![] },
        ]
    }

    pub fn load_or_create(config_path: &Path) -> Result<Self, AppSettingsError> {
        let mut config = if config_path.exists() {
            let content = fs::read_to_string(config_path)?;
            let mut loaded: AppConfig = serde_json::from_str(&content)?;

            if loaded.schema_version != CURRENT_SCHEMA_VERSION {
                eprintln!(
                    "[settings] schema_version mismatch (file={:?}, current={}). \
                     Dropping skill_states and rebuilding on next scan.",
                    loaded.schema_version, CURRENT_SCHEMA_VERSION
                );
                loaded.schema_version = CURRENT_SCHEMA_VERSION.to_string();
                loaded.skill_states.clear();

                let content = serde_json::to_string_pretty(&loaded)?;
                atomic_write(config_path, &content)?;
            }

            loaded
        } else {
            // 创建默认配置并添加预设 Agent
            let mut default = AppConfig::default();
            default.agents = Self::known_agent_presets();

            // 确保父目录存在
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // 保存默认配置
            let content = serde_json::to_string_pretty(&default)?;
            atomic_write(config_path, &content)?;

            default
        };

        // 清理：删除已从预设中移除的内置 agent（如 trae-cn 已合并到 trae）
        const REMOVED_PRESETS: &[&str] = &["trae-cn"];
        let before_len = config.agents.len();
        config.agents.retain(|a| !REMOVED_PRESETS.contains(&a.name.as_str()));
        let mut config_updated = config.agents.len() != before_len;
        if config_updated {
            eprintln!("[settings] removed deprecated agents: {:?}", REMOVED_PRESETS);
        }

        // 补全：把前端已知但 config 中缺失的 agent 追加进去；
        // 同时把现有 agent 的 extra_paths 与 preset 保持同步（字段新增时的升级兼容）。
        // 同时同步 skills_path（修复 v1.0.3 之前 Claude 的 skills/plugins 错误配置）
        for preset in Self::known_agent_presets() {
            if let Some(existing) = config.agents.iter_mut().find(|a| a.name == preset.name) {
                // 仅在用户未设置（空数组）且 preset 有值时才补充，避免覆盖用户的自定义路径
                if existing.extra_paths.is_empty() && !preset.extra_paths.is_empty() {
                    existing.extra_paths = preset.extra_paths.clone();
                    config_updated = true;
                }
                // 同步 skills_path（v1.0.3 之前的版本配置错误，需要自动修复）
                if existing.skills_path != preset.skills_path {
                    eprintln!("[settings] fixing skills_path for {}: {} -> {}", existing.name, existing.skills_path, preset.skills_path);
                    existing.skills_path = preset.skills_path.clone();
                    config_updated = true;
                }
            } else {
                eprintln!("[settings] adding missing agent: {}", preset.name);
                config.agents.push(preset);
                config_updated = true;
            }
        }
        if config_updated {
            let content = serde_json::to_string_pretty(&config)?;
            atomic_write(config_path, &content)?;
        }

        Ok(Self {
            config_path: config_path.to_path_buf(),
            config,
        })
    }

    /// 获取配置
    pub fn get_config(&self) -> &AppConfig {
        &self.config
    }

    /// 获取可变配置
    pub fn get_config_mut(&mut self) -> &mut AppConfig {
        &mut self.config
    }

    /// 保存配置
    pub fn save(&self) -> Result<(), AppSettingsError> {
        let content = serde_json::to_string_pretty(&self.config)?;
        atomic_write(&self.config_path, &content)?;
        Ok(())
    }

    /// 添加 Agent
    pub fn add_agent(&mut self, agent: AgentConfig) -> Result<(), AppSettingsError> {
        // 检查是否已存在同名 Agent
        if self.config.agents.iter().any(|a| a.name == agent.name) {
            return Err(AppSettingsError::AgentAlreadyExists(format!(
                "Agent '{}' already exists",
                agent.name
            )));
        }

        self.config.agents.push(agent);
        Ok(())
    }

    /// 移除 Agent
    pub fn remove_agent(&mut self, name: &str) -> Result<(), AppSettingsError> {
        let original_len = self.config.agents.len();
        self.config.agents.retain(|a| a.name != name);

        if self.config.agents.len() == original_len {
            return Err(AppSettingsError::AgentNotFound(name.to_string()));
        }

        Ok(())
    }

    /// 更新 Agent
    #[allow(dead_code)]
    pub fn update_agent(&mut self, name: &str, updated: AgentConfig) -> Result<(), AppSettingsError> {
        let pos = self.config.agents
            .iter()
            .position(|a| a.name == name)
            .ok_or_else(|| AppSettingsError::AgentNotFound(name.to_string()))?;

        self.config.agents[pos] = updated;
        Ok(())
    }

    /// 设置链接策略
    pub fn set_linking_strategy(&mut self, strategy: LinkStrategy) -> Result<(), AppSettingsError> {
        self.config.linking_strategy = strategy;
        Ok(())
    }

    /// 更新语言偏好
    pub fn update_language(&mut self, lang: &str) -> Result<(), AppSettingsError> {
        self.config.language = lang.to_string();
        self.save()?;
        Ok(())
    }

    /// 设置 skill 隐藏前缀列表（用于托盘菜单与前端共享）。
    /// 做一次 trim + 去空 + 去重，保持稳定顺序。
    pub fn set_skill_hide_prefixes(&mut self, prefixes: Vec<String>) -> Result<(), AppSettingsError> {
        let mut seen = std::collections::HashSet::new();
        let normalized: Vec<String> = prefixes
            .into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && seen.insert(s.clone()))
            .collect();
        self.config.skill_hide_prefixes = normalized;
        self.save()?;
        Ok(())
    }

    /// 获取技能管理器基础目录
    pub fn get_skills_manager_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap()
            .join(".skills-manager")
    }

    /// 获取技能目录
    pub fn get_skills_dir() -> PathBuf {
        Self::get_skills_manager_dir().join("skills")
    }

    /// 获取配置文件路径
    pub fn get_config_path() -> PathBuf {
        Self::get_skills_manager_dir().join("config.json")
    }

    /// 检测系统中的 Agent
    pub fn detect_agents(&mut self) -> Result<usize, AppSettingsError> {
        let mut detected_count = 0;
        let home_dir = dirs::home_dir()
            .ok_or_else(|| AppSettingsError::AgentNotFound(
                "Cannot find home directory".to_string()
            ))?;

        for agent in &mut self.config.agents {
            // 正确处理 ~/ 前缀
            let agent_path = if agent.path.starts_with("~/") {
                home_dir.join(&agent.path[2..])
            } else if agent.path.starts_with("~") {
                home_dir.join(&agent.path[1..])
            } else {
                home_dir.join(&agent.path)
            };

            let extra_exists = agent.extra_paths.iter().any(|ep| {
                let p = if ep.starts_with("~/") {
                    home_dir.join(&ep[2..])
                } else if ep.starts_with('~') {
                    home_dir.join(&ep[1..])
                } else {
                    home_dir.join(ep.as_str())
                };
                p.exists()
            });

            eprintln!("Checking agent path: {:?}, exists: {}", agent_path, agent_path.exists());
            agent.detected = agent_path.exists() || extra_exists;

            if agent.detected {
                detected_count += 1;
            }
        }

        eprintln!("Detected {} out of {} agents", detected_count, self.config.agents.len());
        Ok(detected_count)
    }
}
