use serde_json;
use crate::models::{AgentConfig, LinkStrategy, SkillMetadata, SkillSource};
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
            repository: None,
            enabled: true,
            agent_enabled: HashMap::from([
                ("claude-code".to_string(), true),
                ("cursor".to_string(), false),
            ]),
            agent_enabled_backup: None,
            installed_at: "2025-03-29T10:00:00Z".to_string(),
            last_updated: "2025-03-29T10:00:00Z".to_string(),
            source: SkillSource::Global,
            is_collected: false,
            path: Some("/tmp/test-skill".to_string()),
        };

        let json = serde_json::to_string(&skill).unwrap();
        let deserialized: SkillMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, skill.id);
        assert_eq!(deserialized.name, skill.name);
        assert_eq!(deserialized.agent_enabled.len(), 2);
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
}
