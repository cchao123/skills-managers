//! 备份仓库的自动生成物：
//! - `README.md`：对人类友好的技能列表 + Claude Code marketplace 使用说明
//! - `.claude-plugin/marketplace.json`：把仓库变成 Claude Code plugin marketplace
//!
//! Schema 细节参考 <https://docs.claude.com/en/docs/claude-code/plugin-marketplaces>。

use crate::models::GitHubRepoConfig;
use std::fs;
use std::path::Path;

/// 扫描 skills 目录，自动生成 README.md。
pub(super) fn generate_readme(skills_dir: &Path, config: &GitHubRepoConfig) {
    let mut skills = Vec::new();

    if let Ok(entries) = fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }

            let id = path.file_name().unwrap().to_string_lossy().to_string();
            let (name, desc) = parse_skill_meta(&skill_md);
            skills.push((id, name, desc));
        }
    }

    skills.sort_by(|a, b| a.0.cmp(&b.0));

    let marketplace_name = sanitize_plugin_name(&config.repo);
    let owner_repo = format!("{}/{}", config.owner, config.repo);

    let mut content = String::from(
        "# Skills Backup\n\n\
         > Synced by [Skills Manager](https://github.com/cchao123/skills-managers) — \
         a desktop app for managing AI coding agent skills.\n\n",
    );

    // Claude Code marketplace 使用说明
    content.push_str("## Use as a Claude Code marketplace\n\n");
    content.push_str(
        "This repository is auto-generated as a \
         [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces). \
         Each skill below is exposed as an individually installable plugin.\n\n",
    );
    content.push_str("In Claude Code, add this marketplace:\n\n");
    content.push_str("```bash\n");
    content.push_str(&format!("/plugin marketplace add {}\n", owner_repo));
    content.push_str("```\n\n");
    content.push_str("Then install any skill you want:\n\n");
    content.push_str("```bash\n");
    if let Some((_, first_name, _)) = skills.first() {
        let example = if first_name.is_empty() {
            sanitize_plugin_name(&skills[0].0)
        } else {
            sanitize_plugin_name(first_name)
        };
        content.push_str(&format!("/plugin install {}@{}\n", example, marketplace_name));
    } else {
        content.push_str(&format!("/plugin install <skill-name>@{}\n", marketplace_name));
    }
    content.push_str("```\n\n");
    content.push_str(&format!(
        "Browse all available skills with `/plugin` after adding the marketplace, \
         or see the full list in [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json).\n\n",
    ));

    if skills.is_empty() {
        content.push_str("*No skills yet.*\n");
    } else {
        content.push_str(&format!("## Skills ({})\n\n", skills.len()));
        content.push_str("| # | Skill | Description |\n");
        content.push_str("|---|-------|-------------|\n");
        for (i, (_id, name, desc)) in skills.iter().enumerate() {
            let desc = desc.replace('|', "\\|").replace('\n', " ");
            content.push_str(&format!("| {} | **{}** | {} |\n", i + 1, name, desc));
        }
        content.push('\n');
    }

    let readme_path = skills_dir.join("README.md");
    let _ = fs::write(&readme_path, content);
    eprintln!("[sync] README.md generated with {} skills", skills.len());
}

/// 扫描 skills 目录，自动生成 `.claude-plugin/marketplace.json`。
///
/// 把仓库变成一个 Claude Code plugin marketplace：
/// - 仓库根的每个含 `SKILL.md` 的子目录 → 一个独立 plugin
/// - 用户可以 `/plugin marketplace add <owner>/<repo>` 再 `/plugin install <skill>@<marketplace>` 按需安装
pub(super) fn generate_marketplace_json(skills_dir: &Path, config: &GitHubRepoConfig) {
    let mut plugins: Vec<serde_json::Value> = Vec::new();

    if let Ok(entries) = fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }

            let dir_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            // 隐藏目录（如 `.claude-plugin` 自身、`.restore-tmp` 等）直接跳过
            if dir_name.starts_with('.') {
                continue;
            }

            let plugin_name = sanitize_plugin_name(&dir_name);
            if plugin_name.is_empty() {
                continue;
            }

            let (_name_in_yaml, description) = parse_skill_meta(&skill_md);

            // 每个 skill 目录以 strict:false + skills:["./"] 声明为 "目录本身即 skill"
            let mut entry_obj = serde_json::Map::new();
            entry_obj.insert("name".to_string(), serde_json::Value::String(plugin_name));
            entry_obj.insert(
                "source".to_string(),
                serde_json::Value::String(format!("./{}", dir_name)),
            );
            if !description.is_empty() {
                entry_obj.insert(
                    "description".to_string(),
                    serde_json::Value::String(description),
                );
            }
            entry_obj.insert("strict".to_string(), serde_json::Value::Bool(false));
            entry_obj.insert(
                "skills".to_string(),
                serde_json::Value::Array(vec![serde_json::Value::String("./".to_string())]),
            );

            plugins.push(serde_json::Value::Object(entry_obj));
        }
    }

    // 稳定排序：按 name 排，便于 diff 和 review
    plugins.sort_by(|a, b| {
        let an = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let bn = b.get("name").and_then(|v| v.as_str()).unwrap_or("");
        an.cmp(bn)
    });

    let marketplace_name = sanitize_plugin_name(&config.repo);
    let owner_name = if config.owner.trim().is_empty() {
        "unknown".to_string()
    } else {
        config.owner.clone()
    };

    let mut root = serde_json::Map::new();
    root.insert(
        "name".to_string(),
        serde_json::Value::String(marketplace_name),
    );
    let mut owner_obj = serde_json::Map::new();
    owner_obj.insert("name".to_string(), serde_json::Value::String(owner_name));
    root.insert("owner".to_string(), serde_json::Value::Object(owner_obj));

    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "description".to_string(),
        serde_json::Value::String("Skills backup synced by Skills Manager".to_string()),
    );
    metadata.insert(
        "version".to_string(),
        serde_json::Value::String(chrono::Utc::now().format("%Y.%m.%d").to_string()),
    );
    root.insert("metadata".to_string(), serde_json::Value::Object(metadata));

    root.insert(
        "plugins".to_string(),
        serde_json::Value::Array(plugins.clone()),
    );

    let json = match serde_json::to_string_pretty(&serde_json::Value::Object(root)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[sync] marketplace.json 序列化失败: {}", e);
            return;
        }
    };

    let marketplace_dir = skills_dir.join(".claude-plugin");
    if let Err(e) = fs::create_dir_all(&marketplace_dir) {
        eprintln!("[sync] 创建 .claude-plugin 目录失败: {}", e);
        return;
    }
    let marketplace_path = marketplace_dir.join("marketplace.json");
    if let Err(e) = fs::write(&marketplace_path, json) {
        eprintln!("[sync] 写入 marketplace.json 失败: {}", e);
        return;
    }
    eprintln!(
        "[sync] marketplace.json generated with {} plugins",
        plugins.len()
    );
}

/// 从 SKILL.md 提取 name 和 description。
fn parse_skill_meta(path: &Path) -> (String, String) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return ("".to_string(), "".to_string()),
    };
    let re = regex::Regex::new(r"(?s)^---[\r\n]+(.*?)[\r\n]+---").unwrap();
    let yaml = match re.captures(&content).and_then(|c| c.get(1)) {
        Some(m) => m.as_str().to_string(),
        None => return ("".to_string(), "".to_string()),
    };
    let yaml_val: serde_yaml::Value = match serde_yaml::from_str(&yaml) {
        Ok(v) => v,
        Err(_) => return ("".to_string(), "".to_string()),
    };
    let name = yaml_val
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let desc = yaml_val
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    (name, desc)
}

/// 把任意字符串规约成 Claude marketplace/plugin 允许的 kebab-case 名字。
///
/// 规则：
/// - 全部小写
/// - 仅保留 `[a-z0-9-]`，其他字符一律转成 `-`
/// - 合并连续 `-`，去掉首尾 `-`
fn sanitize_plugin_name(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut prev_dash = false;
    for ch in raw.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}
