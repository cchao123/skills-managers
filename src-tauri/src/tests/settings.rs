use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_default_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let result = crate::settings::AppSettingsManager::load_or_create(&config_path);

        assert!(result.is_ok());
        let manager = result.unwrap();
        let config = manager.get_config();

        // Phase 2: Updated to 5 default agents (was 3)
        assert_eq!(config.agents.len(), 5);
        assert_eq!(config.agents[0].name, "claude");
        assert_eq!(config.agents[1].name, "cursor");
        assert_eq!(config.agents[2].name, "codex");
        assert_eq!(config.agents[3].name, "openclaw");
        assert_eq!(config.agents[4].name, "opencode");
        let claude = config.agents.iter().find(|a| a.name == "claude").unwrap();
        assert_eq!(claude.skills_path, "skills");
    }

    #[test]
    fn test_save_and_load_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();

        // 添加一个测试 Agent
        use crate::models::AgentConfig;
        let agent = AgentConfig {
            name: "test-agent".to_string(),
            display_name: "Test Agent".to_string(),
            path: "~/.test".to_string(),
            skills_path: "skills".to_string(),
            enabled: true,
            detected: false,
        };

        let result = manager.add_agent(agent);

        assert!(result.is_ok());
        manager.save().unwrap();

        // 重新加载验证
        let manager2 = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();
        let config = manager2.get_config();

        // Phase 2: 5 default agents + 1 test agent = 6 total
        assert_eq!(config.agents.len(), 6);
        assert_eq!(config.agents[5].name, "test-agent");
    }

    #[test]
    fn test_remove_agent() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();

        use crate::models::AgentConfig;
        let agent = AgentConfig {
            name: "test-agent".to_string(),
            display_name: "Test Agent".to_string(),
            path: "~/.test".to_string(),
            skills_path: "skills".to_string(),
            enabled: true,
            detected: false,
        };

        manager.add_agent(agent).unwrap();
        // Phase 2: 5 default agents + 1 test = 6 total
        assert_eq!(manager.get_config().agents.len(), 6);

        let result = manager.remove_agent("test-agent");

        assert!(result.is_ok());
        // Phase 2: After removal: 5 default agents remain
        assert_eq!(manager.get_config().agents.len(), 5);
    }

    #[test]
    fn test_schema_version_mismatch_resets_skill_states() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        // 先手写一份"老版本"配置文件：schema_version 不匹配，skill_states 里带一条脏数据
        let legacy = serde_json::json!({
            "schema_version": "v0-legacy",
            "linking_strategy": "symlink",
            "agents": [],
            "skill_states": {
                "stale-skill": { "sources": ["global"], "primary": "global", "open": ["claude"] }
            },
            "language": "zh",
            "skill_hide_prefixes": []
        });
        std::fs::write(&config_path, serde_json::to_string_pretty(&legacy).unwrap()).unwrap();

        let manager = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();
        let config = manager.get_config();

        assert_eq!(config.schema_version, crate::models::CURRENT_SCHEMA_VERSION);
        assert!(config.skill_states.is_empty(), "skill_states should be cleared on mismatch");

        // 文件也应已被写回为新 schema_version
        let on_disk: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&config_path).unwrap()).unwrap();
        assert_eq!(on_disk["schema_version"].as_str(), Some(crate::models::CURRENT_SCHEMA_VERSION));
    }

    #[test]
    fn test_schema_version_match_preserves_skill_states() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let good = serde_json::json!({
            "schema_version": crate::models::CURRENT_SCHEMA_VERSION,
            "linking_strategy": "symlink",
            "agents": [],
            "skill_states": {
                "keep-me": { "sources": ["global"], "primary": "global", "open": ["claude"] }
            },
            "language": "zh",
            "skill_hide_prefixes": []
        });
        std::fs::write(&config_path, serde_json::to_string_pretty(&good).unwrap()).unwrap();

        let manager = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();
        let config = manager.get_config();

        assert!(config.skill_states.contains_key("keep-me"));
    }

    #[test]
    fn test_update_linking_strategy() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();

        use crate::models::LinkStrategy;
        manager.set_linking_strategy(LinkStrategy::Copy).unwrap();
        manager.save().unwrap();

        let manager2 = crate::settings::AppSettingsManager::load_or_create(&config_path).unwrap();
        assert_eq!(manager2.get_config().linking_strategy, LinkStrategy::Copy);
    }
}
