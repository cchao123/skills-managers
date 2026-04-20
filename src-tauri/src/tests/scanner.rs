use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SkillSource;
    use std::collections::HashMap;

    fn create_test_skill(dir: &Path, name: &str, content: &str) -> PathBuf {
        let skill_dir = dir.join(name);
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, content).unwrap();
        skill_dir
    }

    #[test]
    fn test_parse_skill_md_valid() {
        let temp_dir = TempDir::new().unwrap();
        let content = r#"---
name: web-scraper
description: 高效的网页数据抓取工具
category: Web
author: test-user
version: 1.0.0
---

# Web Scraper

这是一个网页抓取工具。
"#;

        let skill_dir = create_test_skill(temp_dir.path(), "web-scraper", content);
        let skill_md = skill_dir.join("SKILL.md");

        let result = crate::scanner::parse_skill_md(&skill_md, SkillSource::Global);

        assert!(result.is_ok());
        let skill = result.unwrap();
        assert_eq!(skill.name, "web-scraper");
        assert_eq!(skill.description, "高效的网页数据抓取工具");
        assert_eq!(skill.category, "Web");
        assert_eq!(skill.author, Some("test-user".to_string()));
        assert_eq!(skill.version, Some("1.0.0".to_string()));
    }

    #[test]
    fn test_parse_skill_md_minimal() {
        let temp_dir = TempDir::new().unwrap();
        let content = r#"---
name: minimal-skill
description: 最小化技能
category: Test
---

Content here
"#;

        let skill_dir = create_test_skill(temp_dir.path(), "minimal", content);
        let skill_md = skill_dir.join("SKILL.md");

        let result = crate::scanner::parse_skill_md(&skill_md, SkillSource::Global);

        assert!(result.is_ok());
        let skill = result.unwrap();
        assert_eq!(skill.name, "minimal-skill");
        assert!(skill.author.is_none());
        assert!(skill.version.is_none());
    }

    #[test]
    fn test_parse_skill_md_missing_frontmatter() {
        let temp_dir = TempDir::new().unwrap();
        let content = r#"# Just a header

No frontmatter here.
"#;

        let skill_dir = create_test_skill(temp_dir.path(), "invalid", content);
        let skill_md = skill_dir.join("SKILL.md");

        let result = crate::scanner::parse_skill_md(&skill_md, SkillSource::Global);

        assert!(result.is_err());
    }

    #[test]
    fn test_scan_skills_directory() {
        let temp_dir = TempDir::new().unwrap();
        let skills_base = temp_dir.path().join("skills");
        fs::create_dir_all(&skills_base).unwrap();

        // 创建多个测试技能
        let skill1_content = r#"---
name: skill-one
description: 第一个技能
category: Test
---

Content
"#;
        create_test_skill(&skills_base, "skill-one", skill1_content);

        let skill2_content = r#"---
name: skill-two
description: 第二个技能
category: Test
---

Content
"#;
        create_test_skill(&skills_base, "skill-two", skill2_content);

        // 创建非 SKILL.md 文件（应该被忽略）
        let other_dir = skills_base.join("other");
        fs::create_dir_all(&other_dir).unwrap();
        fs::write(other_dir.join("README.md"), "readme").unwrap();

        let skill_states = HashMap::new();
        let result = crate::scanner::scan_skills_directory(&skills_base, &skill_states, SkillSource::Global);

        assert!(result.is_ok());
        let skills = result.unwrap();
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].name, "skill-one");
        assert_eq!(skills[1].name, "skill-two");
        // 中央目录且无 skill_states：Agent 子开关默认关，总开关同步为关
        assert!(!skills[0].enabled);
        assert_eq!(skills[0].agent_enabled.get("cursor"), Some(&false));
        assert_eq!(skills[0].agent_enabled.get("claude"), Some(&false));
    }
}
