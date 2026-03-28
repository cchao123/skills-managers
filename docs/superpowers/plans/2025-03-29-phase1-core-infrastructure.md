# Phase 1: 核心基础设施实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 构建 Skills Manager 的 Rust 后端核心模块，实现技能扫描、文件链接和配置管理功能

**架构：** 使用 Tauri 2 + Rust 构建桌面应用后端，提供 IPC 命令接口给前端调用。核心模块包括 Scanner（扫描技能）、LinkManager（管理文件链接）、SettingsManager（配置管理）。

**技术栈：** Rust, Tauri 2, serde, serde_json, dirs, walkdir, thiserror

---

## 文件结构

```
src-tauri/src/
├── commands/
│   ├── skills.rs        # 技能相关的 Tauri 命令
│   └── settings.rs      # 设置相关的 Tauri 命令
├── models.rs            # 数据模型定义
├── scanner.rs           # 技能扫描模块
├── linker.rs            # 文件链接管理模块
├── settings.rs          # 配置管理模块
└── main.rs              # Tauri 主入口（修改）
```

---

## Task 1: 创建数据模型定义

**文件：**
- 创建: `src-tauri/src/models.rs`
- 测试: `src-tauri/src/models_test.rs` (集成测试)

- [ ] **步骤 1: 编写测试 - 验证 SkillMetadata 序列化/反序列化**

在 `src-tauri/src/models_test.rs` 创建测试文件：

```rust
use serde_json;
use crate::models::{SkillMetadata, AgentConfig, LinkStrategy};

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
            agent_enabled: serde_json::Map::from_iter(vec![
                ("claude-code".to_string(), true),
                ("cursor".to_string(), false),
            ].into_iter()),
            installed_at: "2025-03-29T10:00:00Z".to_string(),
            last_updated: "2025-03-29T10:00:00Z".to_string(),
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
            skills_path: "skills/plugins".to_string(),
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
```

- [ ] **步骤 2: 运行测试验证失败**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml`
预期: FAIL，提示 `models` 模块不存在

- [ ] **步骤 3: 实现数据模型**

创建 `src-tauri/src/models.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 技能元数据
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
    pub installed_at: String,
    pub last_updated: String,
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
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
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
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            linking_strategy: LinkStrategy::Symlink,
            agents: vec![],
        }
    }
}
```

- [ ] **步骤 4: 修改 Cargo.toml 添加测试依赖**

在 `src-tauri/Cargo.toml` 的 `[dev-dependencies]` 部分添加：

```toml
[dev-dependencies]
serde_json = "1.0"
```

如果已有 `[dev-dependencies]` 则只添加 `serde_json = "1.0"`

- [ ] **步骤 5: 在 main.rs 中声明测试模块**

在 `src-tauri/src/main.rs` 顶部添加：

```rust
#[cfg(test)]
mod models_test;
```

并在文件开头添加：

```rust
mod models;
```

- [ ] **步骤 6: 运行测试验证通过**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml`
预期: PASS

- [ ] **步骤 7: 提交**

```bash
git add src-tauri/src/models.rs src-tauri/src/models_test.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat(phase1): 添加数据模型定义和测试

- 定义 SkillMetadata, AgentConfig, LinkStrategy, AppConfig
- 添加序列化/反序列化测试
- 使用 serde 进行 JSON 序列化支持"
```

---

## Task 2: 实现技能扫描器 (Scanner)

**文件：**
- 创建: `src-tauri/src/scanner.rs`
- 修改: `src-tauri/src/models.rs` (添加 Scanner 相关类型)
- 测试: `src-tauri/src/scanner_test.rs`

- [ ] **步骤 1: 编写测试 - 解析 SKILL.md frontmatter**

创建 `src-tauri/src/scanner_test.rs`：

```rust
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_skill(dir: &PathBuf, name: &str, content: &str) -> PathBuf {
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

        let result = crate::scanner::parse_skill_md(&skill_md);

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

        let result = crate::scanner::parse_skill_md(&skill_md);

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

        let result = crate::scanner::parse_skill_md(&skill_md);

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

        let result = crate::scanner::scan_skills_directory(&skills_base);

        assert!(result.is_ok());
        let skills = result.unwrap();
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].name, "skill-one");
        assert_eq!(skills[1].name, "skill-two");
    }
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml scan`
预期: FAIL，提示 scanner 模块不存在

- [ ] **步骤 3: 在 Cargo.toml 添加依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 部分添加：

```toml
walkdir = "2.5"
regex = "1.10"
tempfile = "3.10"
```

在 `[dev-dependencies]` 添加（如果还没有）：

```toml
tempfile = "3.10"
```

- [ ] **步骤 4: 实现 Scanner 模块**

创建 `src-tauri/src/scanner.rs`：

```rust
use crate::models::{SkillMetadata};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Debug, Error)]
pub enum ScannerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid SKILL.md format: {0}")]
    InvalidFormat(String),

    #[error("Missing required field: {0}")]
    MissingField(String),
}

/// 解析 SKILL.md 文件的 YAML frontmatter
pub fn parse_skill_md(skill_md_path: &Path) -> Result<SkillMetadata, ScannerError> {
    let content = fs::read_to_string(skill_md_path)?;

    // 提取 YAML frontmatter (--- 包围的部分)
    let frontmatter_re = Regex::new(r"^---\n(.*?)\n---").unwrap();
    let captures = frontmatter_re.captures(&content)
        .ok_or_else(|| ScannerError::InvalidFormat("Missing frontmatter".to_string()))?;

    let yaml_content = captures.get(1).unwrap().as_str();

    // 解析 YAML 字段
    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut category: Option<String> = None;
    let mut author: Option<String> = None;
    let mut version: Option<String> = None;

    for line in yaml_content.lines() {
        let line = line.trim();
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim().to_string();

            match key {
                "name" => name = Some(value),
                "description" => description = Some(value),
                "category" => category = Some(value),
                "author" => author = Some(value),
                "version" => version = Some(value),
                _ => {}
            }
        }
    }

    // 验证必需字段
    let name = name.ok_or_else(|| ScannerError::MissingField("name".to_string()))?;
    let description = description.ok_or_else(|| ScannerError::MissingField("description".to_string()))?;
    let category = category.unwrap_or_else(|| "Uncategorized".to_string());

    // 生成唯一 ID
    let skill_dir = skill_md_path.parent().unwrap();
    let id = skill_dir.file_name()
        .unwrap()
        .to_string_lossy()
        .to_string();

    // 获取文件修改时间
    let metadata = fs::metadata(skill_md_path)?;
    let modified = metadata.modified()?;
    let last_updated: String = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    Ok(SkillMetadata {
        id,
        name,
        description,
        category,
        author,
        version,
        repository: None,
        enabled: true,
        agent_enabled: HashMap::new(),
        installed_at: last_updated.clone(),
        last_updated,
    })
}

/// 扫描技能目录，返回所有找到的技能
pub fn scan_skills_directory(base_path: &Path) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut skills = Vec::new();
    let mut seen_ids = HashSet::new();

    if !base_path.exists() {
        return Ok(skills);
    }

    for entry in WalkDir::new(base_path)
        .min_depth(1)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // 只处理 SKILL.md 文件
        if path.file_name() != Some(std::ffi::OsStr::new("SKILL.md")) {
            continue;
        }

        match parse_skill_md(path) {
            Ok(skill) => {
                if !seen_ids.contains(&skill.id) {
                    seen_ids.insert(skill.id.clone());
                    skills.push(skill);
                }
            }
            Err(e) => {
                eprintln!("Warning: Failed to parse {:?}: {}", path, e);
            }
        }
    }

    skills.sort_by(|a, b| &a.id.cmp(&b.id));
    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;
}
```

- [ ] **步骤 5: 在 main.rs 中声明模块**

在 `src-tauri/src/main.rs` 添加：

```rust
mod scanner;
```

和测试模块：

```rust
#[cfg(test)]
mod scanner_test;
```

- [ ] **步骤 6: 运行测试验证通过**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml scanner`
预期: PASS

- [ ] **步骤 7: 提交**

```bash
git add src-tauri/src/scanner.rs src-tauri/src/scanner_test.rs src-tauri/Cargo.toml src-tauri/src/main.rs
git commit -m "feat(phase1): 实现技能扫描器 Scanner

- 解析 SKILL.md YAML frontmatter
- 扫描目录获取所有技能
- 添加错误处理和验证
- 包含完整的单元测试"
```

---

## Task 3: 实现文件链接管理器 (LinkManager)

**文件：**
- 创建: `src-tauri/src/linker.rs`
- 修改: `src-tauri/src/models.rs` (添加错误类型)
- 测试: `src-tauri/src/linker_test.rs`

- [ ] **步骤 1: 编写测试 - 符号链接创建**

创建 `src-tauri/src/linker_test.rs`：

```rust
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_symlink() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        // 创建源文件
        fs::write(&source, b"test content").unwrap();

        // 创建符号链接
        let result = crate::linker::create_symlink(&source, &target);

        assert!(result.is_ok());
        assert!(target.exists());
        assert_eq!(target.read_link().unwrap(), source);

        // 验证内容一致
        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn test_create_copy_fallback() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();

        // 使用复制方式
        let result = crate::linker::create_copy(&source, &target);

        assert!(result.is_ok());
        assert!(target.exists());

        // 验证是副本而不是链接
        assert!(target.read_link().is_err());

        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "test content");
    }

    #[test]
    fn test_remove_link() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();
        crate::linker::create_symlink(&source, &target).unwrap();

        assert!(target.exists());

        let result = crate::linker::remove_link(&target);

        assert!(result.is_ok());
        assert!(!target.exists());
    }

    #[test]
    fn test_verify_link() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, b"test content").unwrap();
        crate::linker::create_symlink(&source, &target).unwrap();

        assert!(crate::linker::verify_link(&source, &target));

        // 修改源文件，链接应该失效
        fs::remove_file(&source).unwrap();
        assert!(!crate::linker::verify_link(&source, &target));
    }
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml linker`
预期: FAIL，提示 linker 模块不存在

- [ ] **步骤 3: 在 Cargo.toml 添加依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 添加：

```toml
same-file = "1.0"
```

- [ ] **步骤 4: 实现 LinkManager 模块**

创建 `src-tauri/src/linker.rs`：

```rust
use crate::models::{AgentConfig, SkillMetadata, LinkStrategy};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LinkerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Link creation failed: {0}")]
    LinkFailed(String),

    #[error("Agent path not found: {0}")]
    AgentNotFound(String),
}

/// 链接结果
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LinkResult {
    Symlink,
    Copy,
}

/// 创建符号链接
#[cfg(unix)]
pub fn create_symlink(source: &Path, target: &Path) -> Result<LinkResult, LinkerError> {
    // 确保父目录存在
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    // 如果目标已存在，先删除
    if target.exists() {
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
    }

    // 创建符号链接
    std::os::unix::fs::symlink(source, target)?;
    Ok(LinkResult::Symlink)
}

/// 创建符号链接 (Windows)
#[cfg(windows)]
pub fn create_symlink(source: &Path, target: &Path) -> Result<LinkResult, LinkerError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    if target.exists() {
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
    }

    std::os::windows::fs::symlink_dir(source, target)?;
    Ok(LinkResult::Symlink)
}

/// 创建文件副本
pub fn create_copy(source: &Path, target: &Path) -> Result<LinkResult, LinkerError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    if target.exists() {
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
    }

    if source.is_dir() {
        recursive_copy(source, target)?;
    } else {
        fs::copy(source, target)?;
    }

    Ok(LinkResult::Copy)
}

/// 递归复制目录
fn recursive_copy(source: &Path, target: &Path) -> Result<(), LinkerError> {
    fs::create_dir_all(target)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());

        if source_path.is_dir() {
            recursive_copy(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path)?;
        }
    }

    Ok(())
}

/// 移除链接
pub fn remove_link(target: &Path) -> Result<(), LinkerError> {
    if !target.exists() {
        return Ok(());
    }

    if target.is_dir() {
        fs::remove_dir_all(target)?;
    } else {
        fs::remove_file(target)?;
    }

    Ok(())
}

/// 验证链接是否有效
pub fn verify_link(skill_path: &Path, link_path: &Path) -> bool {
    if !link_path.exists() {
        return false;
    }

    // 检查是否是符号链接且指向正确目标
    match link_path.read_link() {
        Ok(target) => target == skill_path,
        Err(_) => {
            // 不是符号链接，检查文件是否相同
            same_file::is_same_file(skill_path, link_path).unwrap_or(false)
        }
    }
}

/// 链接管理器
pub struct LinkManager {
    strategy: LinkStrategy,
}

impl LinkManager {
    pub fn new(strategy: LinkStrategy) -> Self {
        Self { strategy }
    }

    /// 将技能链接到指定 Agent
    pub fn link_skill_to_agent(
        &self,
        skill: &SkillMetadata,
        agent: &AgentConfig,
        skills_base: &Path,
    ) -> Result<LinkResult, LinkerError> {
        // 构建 Agent 的完整路径
        let agent_path = dirs::home_dir()
            .ok_or_else(|| LinkerError::AgentNotFound("Cannot find home directory".to_string()))?
            .join(&agent.path.replace("~", ""));

        if !agent_path.exists() {
            return Err(LinkerError::AgentNotFound(agent.path.clone()));
        }

        let skill_source = skills_base.join(&skill.id);
        let skill_target = agent_path.join(&agent.skills_path).join(&skill.id);

        match self.strategy {
            LinkStrategy::Symlink => {
                match create_symlink(&skill_source, &skill_target) {
                    Ok(result) => Ok(result),
                    Err(_) => {
                        // 符号链接失败，降级到复制
                        eprintln!("Symlink failed, falling back to copy for {}", skill.id);
                        create_copy(&skill_source, &skill_target)
                    }
                }
            }
            LinkStrategy::Copy => {
                create_copy(&skill_source, &skill_target)
            }
        }
    }

    /// 从 Agent 移除技能链接
    pub fn unlink_skill_from_agent(
        &self,
        skill: &SkillMetadata,
        agent: &AgentConfig,
    ) -> Result<(), LinkerError> {
        let agent_path = dirs::home_dir()
            .ok_or_else(|| LinkerError::AgentNotFound("Cannot find home directory".to_string()))?
            .join(&agent.path.replace("~", ""));

        let skill_target = agent_path.join(&agent.skills_path).join(&skill.id);
        remove_link(&skill_target)
    }

    /// 更新技能在所有 Agent 中的链接状态
    pub fn update_skill_links(
        &self,
        skill: &SkillMetadata,
        agents: &[AgentConfig],
        skills_base: &Path,
    ) -> Result<Vec<(String, LinkResult)>, LinkerError> {
        let mut results = Vec::new();

        for agent in agents {
            if !agent.enabled {
                continue;
            }

            let should_link = skill.agent_enabled.get(&agent.name).copied().unwrap_or(false);

            if should_link {
                match self.link_skill_to_agent(skill, agent, skills_base) {
                    Ok(result) => results.push((agent.name.clone(), result)),
                    Err(e) => {
                        eprintln!("Failed to link {} to {}: {}", skill.id, agent.name, e);
                    }
                }
            } else {
                // 移除链接
                let _ = self.unlink_skill_from_agent(skill, agent);
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
}
```

- [ ] **步骤 5: 在 Cargo.toml 添加 dirs 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 添加：

```toml
dirs = "5.0"
```

- [ ] **步骤 6: 在 main.rs 中声明模块**

在 `src-tauri/src/main.rs` 添加：

```rust
mod linker;
```

和测试模块：

```rust
#[cfg(test)]
mod linker_test;
```

- [ ] **步骤 7: 运行测试验证通过**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml linker`
预期: PASS

- [ ] **步骤 8: 提交**

```bash
git add src-tauri/src/linker.rs src-tauri/src/linker_test.rs src-tauri/Cargo.toml src-tauri/src/main.rs
git commit -m "feat(phase1): 实现文件链接管理器 LinkManager

- 支持符号链接和文件复制两种策略
- 符号链接失败时自动降级到复制
- 跨平台支持（Unix/Windows）
- 链接验证和移除功能
- 包含完整的单元测试"
```

---

## Task 4: 实现配置管理器 (SettingsManager)

**文件：**
- 创建: `src-tauri/src/settings.rs`
- 测试: `src-tauri/src/settings_test.rs`

- [ ] **步骤 1: 编写测试 - 配置读写**

创建 `src-tauri/src/settings_test.rs`：

```rust
use std::path::PathBuf;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_default_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let result = crate::settings::SettingsManager::load_or_create(&config_path);

        assert!(result.is_ok());
        let manager = result.unwrap();
        let config = manager.get_config();

        assert_eq!(config.agents.len(), 0);
    }

    #[test]
    fn test_save_and_load_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::SettingsManager::load_or_create(&config_path).unwrap();

        // 添加一个 Agent
        use crate::models::{AgentConfig, LinkStrategy};
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
        let manager2 = crate::settings::SettingsManager::load_or_create(&config_path).unwrap();
        let config = manager2.get_config();

        assert_eq!(config.agents.len(), 1);
        assert_eq!(config.agents[0].name, "test-agent");
    }

    #[test]
    fn test_remove_agent() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::SettingsManager::load_or_create(&config_path).unwrap();

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
        assert_eq!(manager.get_config().agents.len(), 1);

        let result = manager.remove_agent("test-agent");

        assert!(result.is_ok());
        assert_eq!(manager.get_config().agents.len(), 0);
    }

    #[test]
    fn test_update_linking_strategy() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let mut manager = crate::settings::SettingsManager::load_or_create(&config_path).unwrap();

        use crate::models::LinkStrategy;
        manager.set_linking_strategy(LinkStrategy::Copy).unwrap();
        manager.save().unwrap();

        let manager2 = crate::settings::SettingsManager::load_or_create(&config_path).unwrap();
        assert_eq!(manager2.get_config().linking_strategy, LinkStrategy::Copy);
    }
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml settings`
预期: FAIL，提示 settings 模块不存在

- [ ] **步骤 3: 实现 SettingsManager 模块**

创建 `src-tauri/src/settings.rs`：

```rust
use crate::models::{AgentConfig, AppConfig, LinkStrategy};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),
}

/// 配置管理器
pub struct SettingsManager {
    config_path: PathBuf,
    config: AppConfig,
}

impl SettingsManager {
    /// 加载或创建配置文件
    pub fn load_or_create(config_path: &Path) -> Result<Self, SettingsError> {
        let config = if config_path.exists() {
            // 加载现有配置
            let content = fs::read_to_string(config_path)?;
            serde_json::from_str(&content)?
        } else {
            // 创建默认配置
            let default = AppConfig::default();

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

    /// 保存配置
    pub fn save(&self) -> Result<(), SettingsError> {
        let content = serde_json::to_string_pretty(&self.config)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    /// 添加 Agent
    pub fn add_agent(&mut self, agent: AgentConfig) -> Result<(), SettingsError> {
        // 检查是否已存在同名 Agent
        if self.config.agents.iter().any(|a| a.name == agent.name) {
            return Err(SettingsError::AgentNotFound(format!(
                "Agent '{}' already exists",
                agent.name
            )));
        }

        self.config.agents.push(agent);
        Ok(())
    }

    /// 移除 Agent
    pub fn remove_agent(&mut self, name: &str) -> Result<(), SettingsError> {
        let original_len = self.config.agents.len();
        self.config.agents.retain(|a| a.name != name);

        if self.config.agents.len() == original_len {
            return Err(SettingsError::AgentNotFound(name.to_string()));
        }

        Ok(())
    }

    /// 更新 Agent
    pub fn update_agent(&mut self, name: &str, updated: AgentConfig) -> Result<(), SettingsError> {
        let pos = self.config.agents
            .iter()
            .position(|a| a.name == name)
            .ok_or_else(|| SettingsError::AgentNotFound(name.to_string()))?;

        self.config.agents[pos] = updated;
        Ok(())
    }

    /// 设置链接策略
    pub fn set_linking_strategy(&mut self, strategy: LinkStrategy) -> Result<(), SettingsError> {
        self.config.linking_strategy = strategy;
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
}

#[cfg(test)]
mod tests {
    use super::*;
}
```

- [ ] **步骤 4: 在 main.rs 中声明模块**

在 `src-tauri/src/main.rs` 添加：

```rust
mod settings;
```

和测试模块：

```rust
#[cfg(test)]
mod settings_test;
```

- [ ] **步骤 5: 运行测试验证通过**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml settings`
预期: PASS

- [ ] **步骤 6: 提交**

```bash
git add src-tauri/src/settings.rs src-tauri/src/settings_test.rs src-tauri/src/main.rs
git commit -m "feat(phase1): 实现配置管理器 SettingsManager

- 加载和保存配置文件（JSON 格式）
- Agent 配置的增删改查
- 链接策略管理
- 自动创建默认配置
- 包含完整的单元测试"
```

---

## Task 5: 实现 Tauri 命令接口

**文件：**
- 创建: `src-tauri/src/commands/skills.rs`
- 创建: `src-tauri/src/commands/settings.rs`
- 创建: `src-tauri/src/commands/mod.rs`
- 修改: `src-tauri/src/main.rs`

- [ ] **步骤 1: 创建 commands 模块结构**

创建 `src-tauri/src/commands/mod.rs`：

```rust
pub mod skills;
pub mod settings;
```

- [ ] **步骤 2: 实现技能相关命令**

创建 `src-tauri/src/commands/skills.rs`：

```rust
use crate::linker::LinkManager;
use crate::models::{SkillMetadata, AgentConfig};
use crate::scanner;
use crate::settings::SettingsManager;
use std::sync::Mutex;
use tauri::State;

/// 应用状态
pub struct AppState {
    pub settings_manager: Mutex<SettingsManager>,
}

/// 列出所有已安装的技能
#[tauri::command]
pub async fn list_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    let settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills_dir = SettingsManager::get_skills_dir();

    scanner::scan_skills_directory(&skills_dir)
        .map_err(|e| format!("Failed to scan skills: {}", e))
}

/// 启用技能（全局或特定 Agent）
#[tauri::command]
pub async fn enable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills_dir = SettingsManager::get_skills_dir();
    let skills = scanner::scan_skills_directory(&skills_dir)
        .map_err(|e| format!("Failed to scan skills: {}", e))?;

    let mut skill = skills.into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let config = settings.get_config();
    let linker = LinkManager::new(config.linking_strategy);

    if let Some(agent_name) = agent {
        // 启用特定 Agent
        let agent_config = config.agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;

        skill.agent_enabled.insert(agent_name.clone(), true);

        linker.link_skill_to_agent(&skill, agent_config, &skills_dir)
            .map_err(|e| format!("Failed to link skill: {}", e))?;
    } else {
        // 全局启用
        skill.enabled = true;

        for agent_config in &config.agents {
            if agent_config.enabled {
                skill.agent_enabled.insert(agent_config.name.clone(), true);
                let _ = linker.link_skill_to_agent(&skill, agent_config, &skills_dir);
            }
        }
    }

    // TODO: 保存技能状态到配置文件

    Ok(())
}

/// 禁用技能（全局或特定 Agent）
#[tauri::command]
pub async fn disable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills_dir = SettingsManager::get_skills_dir();
    let skills = scanner::scan_skills_directory(&skills_dir)
        .map_err(|e| format!("Failed to scan skills: {}", e))?;

    let skill = skills.into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let config = settings.get_config();
    let linker = LinkManager::new(config.linking_strategy);

    if let Some(agent_name) = agent {
        // 禁用特定 Agent
        let agent_config = config.agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;

        linker.unlink_skill_from_agent(skill, agent_config)
            .map_err(|e| format!("Failed to unlink skill: {}", e))?;
    } else {
        // 全局禁用
        for agent_config in &config.agents {
            if agent_config.enabled {
                let _ = linker.unlink_skill_from_agent(skill, agent_config);
            }
        }
    }

    Ok(())
}

/// 获取技能内容
#[tauri::command]
pub async fn get_skill_content(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let skills_dir = SettingsManager::get_skills_dir();
    let skill_md = skills_dir.join(&skill_id).join("SKILL.md");

    std::fs::read_to_string(&skill_md)
        .map_err(|e| format!("Failed to read skill content: {}", e))
}

/// 重新扫描技能目录
#[tauri::command]
pub async fn rescan_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    list_skills(state).await
}
```

- [ ] **步骤 3: 实现设置相关命令**

创建 `src-tauri/src/commands/settings.rs`：

```rust
use crate::models::{AgentConfig, AppConfig, LinkStrategy};
use crate::settings::SettingsManager;
use std::sync::Mutex;
use tauri::State;

use crate::commands::skills::AppState;

/// 获取所有 Agent 配置
#[tauri::command]
pub async fn get_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConfig>, String> {
    let settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(settings.get_config().agents.clone())
}

/// 添加 Agent 配置
#[tauri::command]
pub async fn add_agent(
    agent: AgentConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    settings.add_agent(agent)
        .map_err(|e| format!("Failed to add agent: {}", e))?;

    settings.save()
        .map_err(|e| format!("Failed to save config: {}", e))
}

/// 移除 Agent 配置
#[tauri::command]
pub async fn remove_agent(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    settings.remove_agent(&name)
        .map_err(|e| format!("Failed to remove agent: {}", e))?;

    settings.save()
        .map_err(|e| format!("Failed to save config: {}", e))
}

/// 获取应用配置
#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<AppConfig, String> {
    let settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(settings.get_config().clone())
}

/// 设置链接策略
#[tauri::command]
pub async fn set_linking_strategy(
    strategy: LinkStrategy,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    settings.set_linking_strategy(strategy)
        .map_err(|e| format!("Failed to set linking strategy: {}", e))?;

    settings.save()
        .map_err(|e| format!("Failed to save config: {}", e))
}

/// 打开技能管理器文件夹
#[tauri::command]
pub async fn open_skills_manager_folder() -> Result<(), String> {
    let skills_dir = SettingsManager::get_skills_manager_dir();

    // 确保目录存在
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&skills_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&skills_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&skills_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
```

- [ ] **步骤 4: 更新 main.rs 集成命令**

修改 `src-tauri/src/main.rs`：

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod scanner;
mod linker;
mod settings;

use commands::skills::AppState;
use settings::SettingsManager;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 初始化 SettingsManager
            let config_path = SettingsManager::get_config_path();
            let settings_manager = SettingsManager::load_or_create(&config_path)
                .expect("Failed to initialize SettingsManager");

            // 设置应用状态
            app.manage(AppState {
                settings_manager: Mutex::new(settings_manager),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Skills commands
            commands::skills::list_skills,
            commands::skills::enable_skill,
            commands::skills::disable_skill,
            commands::skills::get_skill_content,
            commands::skills::rescan_skills,
            // Settings commands
            commands::settings::get_agents,
            commands::settings::add_agent,
            commands::settings::remove_agent,
            commands::settings::get_config,
            commands::settings::set_linking_strategy,
            commands::settings::open_skills_manager_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod models_test;
#[cfg(test)]
mod scanner_test;
#[cfg(test)]
mod linker_test;
#[cfg(test)]
mod settings_test;
```

- [ ] **步骤 5: 运行测试验证编译通过**

运行: `cargo build --manifest-path=src-tauri/Cargo.toml`
预期: 编译成功

- [ ] **步骤 6: 测试应用启动**

运行: `npm run tauri dev`
预期: 应用正常启动，Tauri 命令已注册

- [ ] **步骤 7: 提交**

```bash
git add src-tauri/src/commands/ src-tauri/src/main.rs
git commit -m "feat(phase1): 实现 Tauri 命令接口

- list_skills: 列出所有已安装技能
- enable_skill/disable_skill: 启用/禁用技能
- get_skill_content: 获取技能内容
- get_agents/add_agent/remove_agent: Agent 管理
- get_config/set_linking_strategy: 配置管理
- open_skills_manager_folder: 打开文件夹
- 使用 AppState 管理全局状态"
```

---

## Task 6: 添加默认 Agent 预设

**文件：**
- 修改: `src-tauri/src/settings.rs`

- [ ] **步骤 1: 实现默认 Agent 初始化**

在 `src-tauri/src/settings.rs` 修改 `load_or_create` 方法：

```rust
/// 加载或创建配置文件
pub fn load_or_create(config_path: &Path) -> Result<Self, SettingsError> {
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
                name: "claude-code".to_string(),
                display_name: "Claude Code".to_string(),
                path: "~/.claude".to_string(),
                skills_path: "skills/plugins".to_string(),
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
                name: "windsurf".to_string(),
                display_name: "Windsurf".to_string(),
                path: "~/.windsurf".to_string(),
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
    });
}
```

- [ ] **步骤 2: 添加 Agent 检测功能**

在 `src-tauri/src/settings.rs` 添加：

```rust
impl SettingsManager {
    // ... 其他方法 ...

    /// 检测系统中的 Agent
    pub fn detect_agents(&mut self) -> Result<usize, SettingsError> {
        let mut detected_count = 0;

        for agent in &mut self.config.agents {
            let agent_path = dirs::home_dir()
                .ok_or_else(|| SettingsError::AgentNotFound(
                    "Cannot find home directory".to_string()
                ))?
                .join(&agent.path.replace("~", ""));

            agent.detected = agent_path.exists();

            if agent.detected {
                detected_count += 1;
            }
        }

        Ok(detected_count)
    }
}
```

- [ ] **步骤 3: 添加检测命令**

在 `src-tauri/src/commands/settings.rs` 添加：

```rust
/// 检测系统中的 Agent
#[tauri::command]
pub async fn detect_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConfig>, String> {
    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    settings.detect_agents()
        .map_err(|e| format!("Failed to detect agents: {}", e))?;

    settings.save()
        .map_err(|e| format!("Failed to save config: {}", e))?;

    Ok(settings.get_config().agents.clone())
}
```

- [ ] **步骤 4: 更新 main.rs 注册新命令**

在 `src-tauri/src/main.rs` 的 `invoke_handler` 中添加：

```rust
commands::settings::detect_agents,
```

- [ ] **步骤 5: 编译测试**

运行: `cargo build --manifest-path=src-tauri/Cargo.toml`
预期: 编译成功

- [ ] **步骤 6: 提交**

```bash
git add src-tauri/src/settings.rs src-tauri/src/commands/settings.rs src-tauri/src/main.rs
git commit -m "feat(phase1): 添加默认 Agent 预设和检测功能

- 添加 Claude Code, Cursor, Windsurf 预设
- Agent 检测功能：检查 Agent 目录是否存在
- detect_agents 命令：自动检测并更新 Agent 状态"
```

---

## Task 7: 完善错误处理和日志

**文件：**
- 创建: `src-tauri/src/error.rs`
- 修改: `src-tauri/src/main.rs`

- [ ] **步骤 1: 创建统一错误类型**

创建 `src-tauri/src/error.rs`：

```rust
use thiserror::Error;

/// Skills Manager 统一错误类型
#[derive(Debug, Error)]
pub enum SkillsManagerError {
    #[error("Scanner error: {0}")]
    Scanner(#[from] crate::scanner::ScannerError),

    #[error("Linker error: {0}")]
    Linker(#[from] crate::linker::LinkerError),

    #[error("Settings error: {0}")]
    Settings(#[from] crate::settings::SettingsError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl serde::Serialize for SkillsManagerError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

- [ ] **步骤 2: 在 main.rs 中声明模块**

在 `src-tauri/src/main.rs` 添加：

```rust
mod error;
use error::SkillsManagerError;
```

- [ ] **步骤 3: 添加日志配置**

在 `src-tauri/Cargo.toml` 添加依赖：

```toml
log = "0.4"
env_logger = "0.11"
```

- [ ] **步骤 4: 在 main.rs 初始化日志**

修改 `src-tauri/src/main.rs` 的 `main` 函数：

```rust
fn main() {
    // 初始化日志
    env_logger::init();

    log::info!("Skills Manager starting...");

    tauri::Builder::default()
        // ... 其他配置保持不变
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **步骤 5: 在关键位置添加日志**

在 `src-tauri/src/commands/skills.rs` 添加日志：

```rust
use log::{info, error, warn};

// 在各个命令中添加日志
#[tauri::command]
pub async fn list_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    info!("Listing skills...");

    let settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let skills_dir = SettingsManager::get_skills_dir();
    info!("Scanning skills directory: {:?}", skills_dir);

    let skills = scanner::scan_skills_directory(&skills_dir)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    info!("Found {} skills", skills.len());
    Ok(skills)
}
```

- [ ] **步骤 6: 编译测试**

运行: `cargo build --manifest-path=src-tauri/Cargo.toml`
预期: 编译成功

- [ ] **步骤 7: 提交**

```bash
git add src-tauri/src/error.rs src-tauri/src/main.rs src-tauri/src/commands/skills.rs src-tauri/Cargo.toml
git commit -m "feat(phase1): 完善错误处理和日志系统

- 创建统一错误类型 SkillsManagerError
- 添加 env_logger 日志支持
- 在关键位置添加日志记录
- 改进错误消息的用户体验"
```

---

## 最终验证和文档

- [ ] **最终步骤 1: 运行所有测试**

运行: `cargo test --manifest-path=src-tauri/Cargo.toml`
预期: 所有测试通过

- [ ] **最终步骤 2: 验证应用启动**

运行: `npm run tauri dev`
预期: 应用正常启动，无错误

- [ ] **最终步骤 3: 创建 README 文档**

创建 `docs/phase1-backend-api.md`：

```markdown
# Phase 1: 核心 API 文档

## Tauri 命令

### 技能管理

#### `list_skills()`
列出所有已安装的技能

**返回:** `Vec<SkillMetadata>`

#### `enable_skill(skill_id: String, agent: Option<String>)`
启用技能（全局或特定 Agent）

**参数:**
- `skill_id`: 技能 ID
- `agent`: 可选，Agent 名称

#### `disable_skill(skill_id: String, agent: Option<String>)`
禁用技能（全局或特定 Agent）

**参数:**
- `skill_id`: 技能 ID
- `agent`: 可选，Agent 名称

#### `get_skill_content(skill_id: String)`
获取技能内容

**参数:**
- `skill_id`: 技能 ID

**返回:** `String` (SKILL.md 内容)

### 设置管理

#### `get_agents()`
获取所有 Agent 配置

**返回:** `Vec<AgentConfig>`

#### `add_agent(agent: AgentConfig)`
添加 Agent 配置

**参数:**
- `agent`: Agent 配置对象

#### `remove_agent(name: String)`
移除 Agent 配置

**参数:**
- `name`: Agent 名称

#### `get_config()`
获取应用配置

**返回:** `AppConfig`

#### `set_linking_strategy(strategy: LinkStrategy)`
设置链接策略

**参数:**
- `strategy`: `Symlink` 或 `Copy`

#### `detect_agents()`
检测系统中的 Agent

**返回:** `Vec<AgentConfig>` (更新了 detected 状态)

#### `open_skills_manager_folder()`
打开技能管理器文件夹

## 数据模型

### SkillMetadata
- `id`: String
- `name`: String
- `description`: String
- `category`: String
- `author`: Option<String>
- `version`: Option<String>
- `repository`: Option<String>
- `enabled`: bool
- `agent_enabled`: Map<String, bool>
- `installed_at`: String
- `last_updated`: String

### AgentConfig
- `name`: String
- `display_name`: String
- `path`: String
- `skills_path`: String
- `enabled`: bool
- `detected`: bool

### AppConfig
- `linking_strategy`: LinkStrategy
- `agents`: Vec<AgentConfig>
```

- [ ] **最终步骤 4: 创建 Phase 1 总结文档**

创建 `docs/phase1-summary.md`：

```markdown
# Phase 1 完成总结

## 已完成功能

### 核心模块
- ✅ **Scanner**: 扫描技能目录，解析 SKILL.md frontmatter
- ✅ **LinkManager**: 管理文件链接（符号链接/复制）
- ✅ **SettingsManager**: 配置管理和持久化

### Tauri 命令接口
- ✅ 技能管理：list, enable, disable, get_content, rescan
- ✅ Agent 管理：get, add, remove, detect
- ✅ 配置管理：get_config, set_linking_strategy
- ✅ 工具：open_skills_manager_folder

### 默认配置
- ✅ 预设三个 Agent：Claude Code, Cursor, Windsurf
- ✅ 默认使用符号链接策略
- ✅ 自动创建配置目录和文件

### 测试覆盖
- ✅ 数据模型序列化测试
- ✅ Scanner frontmatter 解析测试
- ✅ LinkManager 符号链接/复制测试
- ✅ SettingsManager 配置读写测试

## 技术亮点

1. **跨平台支持**: Unix/Windows 符号链接自动降级
2. **错误处理**: 统一的错误类型和用户友好的错误消息
3. **日志系统**: 完整的日志记录用于调试
4. **测试驱动**: 每个模块都有完整的单元测试
5. **可扩展性**: 清晰的模块边界和接口定义

## 文件结构

```
src-tauri/src/
├── commands/
│   ├── mod.rs
│   ├── skills.rs       # 技能相关命令
│   └── settings.rs     # 设置相关命令
├── models.rs           # 数据模型
├── scanner.rs          # 技能扫描器
├── linker.rs           # 文件链接管理器
├── settings.rs         # 配置管理器
├── error.rs            # 错误类型
└── main.rs             # Tauri 入口
```

## 下一步

Phase 2 将构建 Dashboard UI，使用这些后端 API 来展示和管理技能。
```

- [ ] **最终步骤 5: 提交文档**

```bash
git add docs/phase1-backend-api.md docs/phase1-summary.md
git commit -m "docs(phase1): 添加 Phase 1 API 文档和总结

- API 文档包含所有 Tauri 命令和数据模型
- Phase 1 总结文档记录已完成功能
- 为 Phase 2 UI 开发提供参考"
```

- [ ] **最终步骤 6: 创建 Phase 1 完成标签**

```bash
git tag -a phase1-complete -m "Phase 1: 核心基础设施完成

完成内容：
- Scanner, LinkManager, SettingsManager 模块
- 完整的 Tauri 命令接口
- 默认 Agent 预设和检测
- 单元测试覆盖
- API 文档"

git push origin phase1-complete
```

---

**Phase 1 完成！** 核心基础设施已就绪，可以开始 Phase 2: Dashboard UI 开发。
