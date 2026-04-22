use std::fs;
use std::path::Path;

#[cfg(test)]
mod tests {

    use super::*;
    use crate::models::{pick_default_primary, SkillEntry, SOURCE_GLOBAL};
    use std::collections::HashMap;

    fn create_test_skill(dir: &Path, name: &str, content: &str) {
        let skill_dir = dir.join(name);
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, content).unwrap();
    }

    #[test]
    fn test_pick_default_primary_prefers_global() {
        let sources = vec![
            "cursor".to_string(),
            SOURCE_GLOBAL.to_string(),
            "claude".to_string(),
        ];
        assert_eq!(pick_default_primary(&sources), Some(SOURCE_GLOBAL.to_string()));
    }

    #[test]
    fn test_skill_entry_insert_source_is_idempotent() {
        let mut e = SkillEntry::default();
        e.insert_source(SOURCE_GLOBAL);
        e.insert_source(SOURCE_GLOBAL);
        e.insert_source("claude");
        assert_eq!(e.sources, vec![SOURCE_GLOBAL.to_string(), "claude".to_string()]);
    }

    #[test]
    fn test_skill_entry_derive_native_plus_open() {
        let e = SkillEntry {
            sources: vec![SOURCE_GLOBAL.to_string(), "openclaw".to_string()],
            primary: SOURCE_GLOBAL.to_string(),
            open: vec!["cursor".to_string()],
        };
        let agents = vec!["cursor".to_string(), "openclaw".to_string(), "claude".to_string()];
        let m = e.derive_agent_enabled(&agents);
        assert_eq!(m.get("cursor"), Some(&true)); // open
        assert_eq!(m.get("openclaw"), Some(&true)); // native
        assert_eq!(m.get("claude"), Some(&false));
    }

    #[test]
    fn test_touch_fs_helpers_dont_panic() {
        // 仅确认 create_test_skill 工具函数工作；扫描本身依赖固定绝对路径，不便于在单测中断言。
        let tmp = tempfile::TempDir::new().unwrap();
        create_test_skill(
            tmp.path(),
            "foo",
            "---\nname: foo\ndescription: d\ncategory: Test\n---\nBody",
        );
        assert!(tmp.path().join("foo").join("SKILL.md").exists());
        let mut _states: HashMap<String, SkillEntry> = HashMap::new();
        // 只调用到 models 层，避免扫描全局目录。
    }
}
