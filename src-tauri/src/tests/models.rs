use crate::models::{
    pick_default_primary, AgentConfig, AppConfig, LinkStrategy, SkillEntry, SkillMetadata,
    CURRENT_SCHEMA_VERSION, SOURCE_GLOBAL,
};
use std::collections::HashMap;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skill_metadata_serialization() {
        let skill = SkillMetadata {
            id: "test-skill-1".to_string(),
            name: "Test Skill".to_string(),
            description: "A test skill".to_string(),
            category: "Testing".to_string(),
            author: Some("test-user".to_string()),
            version: Some("1.0.0".to_string()),
            enabled: true,
            agent_enabled: HashMap::from([
                ("claude".to_string(), true),
                ("cursor".to_string(), false),
            ]),
            installed_at: "2025-03-29T10:00:00Z".to_string(),
            last_updated: "2025-03-29T10:00:00Z".to_string(),
            is_collected: false,
            sources: vec![SOURCE_GLOBAL.to_string()],
            primary: SOURCE_GLOBAL.to_string(),
            open: vec!["claude".to_string()],
            source_paths: HashMap::new(),
        };

        let json = serde_json::to_string(&skill).unwrap();
        let deserialized: SkillMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, skill.id);
        assert_eq!(deserialized.primary, SOURCE_GLOBAL);
        assert_eq!(deserialized.sources, vec![SOURCE_GLOBAL.to_string()]);
        assert_eq!(deserialized.open, vec!["claude".to_string()]);
    }

    #[test]
    fn test_agent_config_serialization() {
        let agent = AgentConfig {
            name: "claude-code".to_string(),
            display_name: "Claude Code".to_string(),
            path: "~/.claude".to_string(),
            skills_path: "skills".to_string(),
            enabled: true,
            detected: false,
        };

        let json = serde_json::to_string(&agent).unwrap();
        let deserialized: AgentConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.name, "claude-code");
        assert_eq!(deserialized.path, "~/.claude");
    }

    #[test]
    fn test_link_strategy_serialization() {
        let strategy = LinkStrategy::Symlink;
        let json = serde_json::to_string(&strategy).unwrap();
        let deserialized: LinkStrategy = serde_json::from_str(&json).unwrap();

        assert!(matches!(deserialized, LinkStrategy::Symlink));
    }

    #[test]
    fn test_skill_entry_derive_agent_enabled() {
        let entry = SkillEntry {
            sources: vec![SOURCE_GLOBAL.to_string(), "cursor".to_string()],
            primary: SOURCE_GLOBAL.to_string(),
            open: vec!["claude".to_string()],
        };

        let agents = vec![
            "claude".to_string(),
            "cursor".to_string(),
            "codex".to_string(),
        ];
        let map = entry.derive_agent_enabled(&agents);

        assert_eq!(map.get("claude"), Some(&true)); // in open
        assert_eq!(map.get("cursor"), Some(&true)); // native (in sources, !=global)
        assert_eq!(map.get("codex"), Some(&false));
    }

    #[test]
    fn test_skill_entry_ensure_valid_primary_repairs_empty() {
        let mut entry = SkillEntry {
            sources: vec!["cursor".to_string(), SOURCE_GLOBAL.to_string()],
            primary: String::new(),
            open: vec![],
        };
        entry.ensure_valid_primary();
        // global 优先级最高
        assert_eq!(entry.primary, SOURCE_GLOBAL);
    }

    #[test]
    fn test_skill_entry_ensure_valid_primary_repairs_stale() {
        let mut entry = SkillEntry {
            sources: vec!["cursor".to_string()],
            primary: "claude".to_string(), // 不在 sources 里
            open: vec![],
        };
        entry.ensure_valid_primary();
        assert_eq!(entry.primary, "cursor");
    }

    #[test]
    fn test_pick_default_primary_priority() {
        let sources = vec!["codex".to_string(), SOURCE_GLOBAL.to_string(), "claude".to_string()];
        assert_eq!(pick_default_primary(&sources), Some(SOURCE_GLOBAL.to_string()));

        let sources = vec!["codex".to_string(), "claude".to_string()];
        assert_eq!(pick_default_primary(&sources), Some("claude".to_string()));

        let sources: Vec<String> = vec![];
        assert_eq!(pick_default_primary(&sources), None);
    }

    #[test]
    fn test_app_config_schema_version_default() {
        let config = AppConfig::default();
        assert_eq!(config.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(config.schema_version, "v1");
    }
}
