use crate::models::{AgentConfig, AppConfig, ClaudeSettings, LinkStrategy};
use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

pub struct SettingsManager {
    settings_path: PathBuf,
}

impl SettingsManager {
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .context("Failed to get home directory")?;
        let settings_path = home.join(".claude").join("settings.json");
        Ok(Self { settings_path })
    }

    pub fn load_settings(&self) -> Result<ClaudeSettings> {
        if !self.settings_path.exists() {
            // Return empty settings if file doesn't exist
            return Ok(ClaudeSettings {
                enabled_plugins: None,
                other: HashMap::new(),
            });
        }

        let content = fs::read_to_string(&self.settings_path)?;
        let settings: ClaudeSettings = serde_json::from_str(&content)?;
        Ok(settings)
    }

    #[allow(dead_code)]
    pub fn save_settings(&self, settings: &ClaudeSettings) -> Result<()> {
        let mut settings_map = HashMap::new();

        // Add enabled_plugins if present
        if let Some(enabled_plugins) = &settings.enabled_plugins {
            let plugins_map: serde_json::Map<String, Value> = enabled_plugins
                .iter()
                .map(|(k, v)| (k.clone(), Value::Bool(*v)))
                .collect();
            settings_map.insert("enabledPlugins".to_string(), Value::Object(plugins_map));
        }

        // Add other fields
        for (key, value) in &settings.other {
            settings_map.insert(key.clone(), value.clone());
        }

        let json = serde_json::to_string_pretty(&settings_map)?;
        fs::write(&self.settings_path, json)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn enable_plugin(&self, plugin_name: &str) -> Result<()> {
        let mut settings = self.load_settings()?;

        if settings.enabled_plugins.is_none() {
            settings.enabled_plugins = Some(HashMap::new());
        }

        if let Some(ref mut enabled) = settings.enabled_plugins {
            enabled.insert(plugin_name.to_string(), true);
        }

        self.save_settings(&settings)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn disable_plugin(&self, plugin_name: &str) -> Result<()> {
        let mut settings = self.load_settings()?;

        if let Some(ref mut enabled) = settings.enabled_plugins {
            enabled.insert(plugin_name.to_string(), false);
        }

        self.save_settings(&settings)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn is_plugin_enabled(&self, plugin_name: &str) -> Result<bool> {
        let settings = self.load_settings()?;

        if let Some(enabled) = settings.enabled_plugins {
            if let Some(is_enabled) = enabled.get(plugin_name) {
                return Ok(*is_enabled);
            }
        }

        // Default to enabled if not specified
        Ok(true)
    }
}

impl Default for SettingsManager {
    fn default() -> Self {
        Self::new().expect("Failed to create SettingsManager")
    }
}

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
    /// 加载或创建配置文件
    pub fn load_or_create(config_path: &Path) -> Result<Self, AppSettingsError> {
        let config = if config_path.exists() {
            // 加载现有配置
            let content = fs::read_to_string(config_path)?;
            serde_json::from_str(&content)?
        } else {
            // 创建默认配置并添加预设 Agent
            let mut default = AppConfig::default();

            // 添加默认 Agent 预设
            default.agents = vec![
                AgentConfig {
                    name: "claude".to_string(),
                    display_name: "Claude".to_string(),
                    path: "~/.claude".to_string(),
                    skills_path: "skills".to_string(),
                    enabled: true,
                    detected: false,
                },
                AgentConfig {
                    name: "cursor".to_string(),
                    display_name: "Cursor".to_string(),
                    path: "~/.cursor".to_string(),
                    skills_path: "skills".to_string(),
                    enabled: true,
                    detected: false,
                },
                AgentConfig {
                    name: "codex".to_string(),
                    display_name: "Codex".to_string(),
                    path: "~/.codex".to_string(),
                    skills_path: "skills".to_string(),
                    enabled: true,
                    detected: false,
                },
                AgentConfig {
                    name: "openclaw".to_string(),
                    display_name: "OpenClaw".to_string(),
                    path: "~/.openclaw".to_string(),
                    skills_path: "skills".to_string(),
                    enabled: true,
                    detected: false,
                },
                AgentConfig {
                    name: "opencode".to_string(),
                    display_name: "OpenCode".to_string(),
                    path: "~/.opencode".to_string(),
                    skills_path: "skills".to_string(),
                    enabled: true,
                    detected: false,
                },
            ];

            // 确保父目录存在
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // 保存默认配置
            let content = serde_json::to_string_pretty(&default)?;
            fs::write(config_path, content)?;

            default
        };

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
        fs::write(&self.config_path, content)?;
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

            eprintln!("Checking agent path: {:?}, exists: {}", agent_path, agent_path.exists());
            agent.detected = agent_path.exists();

            if agent.detected {
                detected_count += 1;
            }
        }

        eprintln!("Detected {} out of {} agents", detected_count, self.config.agents.len());
        Ok(detected_count)
    }
}
