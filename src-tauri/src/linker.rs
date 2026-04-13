use crate::models::{AgentConfig, LinkStrategy, SkillMetadata};
use std::fs;
use std::path::{Path, PathBuf};
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
    eprintln!("=== CREATE_SYMLINK DEBUG ===");
    eprintln!("Source path: {:?}", source);
    eprintln!("Source exists: {}", source.exists());
    eprintln!("Source is_dir: {}", source.is_dir());
    eprintln!("Target path: {:?}", target);
    eprintln!("Target exists: {}", target.exists());

    // 检查源路径是否存在
    if !source.exists() {
        eprintln!("ERROR: Source path does not exist!");
        return Err(LinkerError::LinkFailed(format!("Source path does not exist: {:?}", source)));
    }

    // 确保父目录存在
    if let Some(parent) = target.parent() {
        eprintln!("Target parent: {:?}", parent);
        eprintln!("Parent exists: {}", parent.exists());

        if !parent.exists() {
            eprintln!("Creating parent directory: {:?}", parent);
            fs::create_dir_all(parent)?;
            eprintln!("Parent directory created successfully");
        }
    }

    // 如果目标已存在，先删除
    if target.exists() {
        eprintln!("Target already exists, removing...");
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
        eprintln!("Old target removed");
    }

    // 创建符号链接
    eprintln!("Attempting to create symlink: {:?} -> {:?}", source, target);
    match std::os::unix::fs::symlink(source, target) {
        Ok(_) => {
            eprintln!("Symlink created successfully!");
            eprintln!("=== END CREATE_SYMLINK DEBUG ===");
            Ok(LinkResult::Symlink)
        }
        Err(e) => {
            eprintln!("FAILED to create symlink: {}", e);
            eprintln!("Error kind: {:?}", e.kind());
            eprintln!("=== END CREATE_SYMLINK DEBUG ===");
            Err(LinkerError::Io(e))
        }
    }
}

/// 创建符号链接 (Windows)
#[cfg(windows)]
pub fn create_symlink(source: &Path, target: &Path) -> Result<LinkResult, LinkerError> {
    eprintln!("=== CREATE_SYMLINK DEBUG (Windows) ===");
    eprintln!("Source path: {:?}", source);
    eprintln!("Source exists: {}", source.exists());
    eprintln!("Source is_dir: {}", source.is_dir());
    eprintln!("Target path: {:?}", target);
    eprintln!("Target exists: {}", target.exists());

    // 检查源路径是否存在
    if !source.exists() {
        eprintln!("ERROR: Source path does not exist!");
        return Err(LinkerError::LinkFailed(format!("Source path does not exist: {:?}", source)));
    }

    if let Some(parent) = target.parent() {
        eprintln!("Target parent: {:?}", parent);
        eprintln!("Parent exists: {}", parent.exists());

        if !parent.exists() {
            eprintln!("Creating parent directory: {:?}", parent);
            fs::create_dir_all(parent)?;
            eprintln!("Parent directory created successfully");
        }
    }

    if target.exists() {
        eprintln!("Target already exists, removing...");
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
        eprintln!("Old target removed");
    }

    // Check if source is a file or directory and use appropriate function
    eprintln!("Attempting to create symlink: {:?} -> {:?}", source, target);
    let result = if source.is_dir() {
        std::os::windows::fs::symlink_dir(source, target)?
    } else {
        std::os::windows::fs::symlink_file(source, target)?
    };

    eprintln!("Symlink created successfully!");
    eprintln!("=== END CREATE_SYMLINK DEBUG ===");
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

/// 移除链接（安全版本，只删除符号链接）
pub fn remove_link(target: &Path) -> Result<(), LinkerError> {
    if !target.exists() {
        return Ok(());
    }

    // 安全检查：只删除符号链接，不删除真实目录
    if target.is_symlink() {
        eprintln!("✅ Removing symlink: {:?}", target);
        if target.is_dir() {
            fs::remove_dir_all(target)?;
        } else {
            fs::remove_file(target)?;
        }
        Ok(())
    } else {
        // 如果不是符号链接，说明是真实目录，不应该删除
        eprintln!("⚠️  Warning: Target is not a symlink, refusing to delete: {:?}", target);
        eprintln!("This is a real directory, not a managed symlink. Skipping deletion.");
        Ok(())
    }
}

/// 验证链接是否有效
#[allow(dead_code)]
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

/// 复制技能到中央存储
pub fn copy_to_central_storage(
    skill_source: &Path,
    skill_id: &str,
) -> Result<PathBuf, LinkerError> {
    eprintln!("=== COPY_TO_CENTRAL_STORAGE START ===");
    eprintln!("Skill source: {:?}", skill_source);
    eprintln!("Skill ID: {}", skill_id);

    let home_dir = dirs::home_dir()
        .ok_or_else(|| LinkerError::LinkFailed("Cannot find home directory".to_string()))?;

    let central_storage = home_dir.join(".skills-manager/skills");
    let skill_target = central_storage.join(skill_id);

    eprintln!("Central storage: {:?}", central_storage);
    eprintln!("Target path: {:?}", skill_target);

    // 确保中央存储目录存在
    if !central_storage.exists() {
        eprintln!("Creating central storage directory");
        fs::create_dir_all(&central_storage)?;
    }

    // 如果目标已存在，先删除
    if skill_target.exists() {
        eprintln!("Target already exists, removing...");
        if skill_target.is_dir() {
            fs::remove_dir_all(&skill_target)?;
        } else {
            fs::remove_file(&skill_target)?;
        }
    }

    // 复制技能到中央存储
    eprintln!("Copying skill to central storage...");
    if skill_source.is_dir() {
        recursive_copy(skill_source, &skill_target)?;
    } else {
        fs::copy(skill_source, &skill_target)?;
    }

    eprintln!("✅ Skill copied to central storage: {:?}", skill_target);
    eprintln!("=== COPY_TO_CENTRAL_STORAGE SUCCESS ===");

    Ok(skill_target)
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
        _skills_base: &Path,
    ) -> Result<LinkResult, LinkerError> {
        eprintln!("=== LINK_SKILL_TO_AGENT START ===");
        eprintln!("Skill ID: {}", skill.id);
        eprintln!("Agent name: {}", agent.name);
        eprintln!("Skill source: {:?}", skill.source);

        // 获取技能的完整路径
        let skill_path = skill.path.as_ref()
            .ok_or_else(|| LinkerError::LinkFailed(format!("Skill {} has no path", skill.id)))?;
        let skill_source = Path::new(skill_path);

        eprintln!("Skill source path: {:?}", skill_source);
        eprintln!("Skill source exists: {}", skill_source.exists());

        if !skill_source.exists() {
            eprintln!("ERROR: Skill source path does not exist!");
            return Err(LinkerError::LinkFailed(format!("Skill path does not exist: {:?}", skill_source)));
        }

        // 检查技能是否已经在中央存储
        let home_dir = dirs::home_dir()
            .ok_or_else(|| LinkerError::AgentNotFound("Cannot find home directory".to_string()))?;
        let central_storage = home_dir.join(".skills-manager/skills");
        let central_skill_path = central_storage.join(&skill.id);

        eprintln!("Central storage: {:?}", central_storage);
        eprintln!("Central skill path: {:?}", central_skill_path);
        eprintln!("Central skill exists: {}", central_skill_path.exists());

        // 如果技能不在中央存储，复制过去
        let link_source = if central_skill_path.exists() {
            eprintln!("✅ Skill already in central storage");
            central_skill_path
        } else {
            eprintln!("📋 Copying skill to central storage...");
            copy_to_central_storage(skill_source, &skill.id)?
        };

        // 构建 Agent 的完整路径
        eprintln!("Home directory: {:?}", home_dir);

        // 正确处理 ~/ 前缀
        let agent_path = if agent.path.starts_with("~/") {
            eprintln!("Agent path starts with ~/");
            home_dir.join(&agent.path[2..])
        } else if agent.path.starts_with("~") {
            eprintln!("Agent path starts with ~");
            home_dir.join(&agent.path[1..])
        } else {
            eprintln!("Agent path does not start with ~");
            home_dir.join(&agent.path)
        };

        eprintln!("Agent path config: {}", agent.path);
        eprintln!("Agent full path: {:?}", agent_path);
        eprintln!("Agent path exists: {}", agent_path.exists());

        if !agent_path.exists() {
            eprintln!("ERROR: Agent path does not exist!");
            return Err(LinkerError::AgentNotFound(agent.path.clone()));
        }

        let skill_target = agent_path.join(&agent.skills_path).join(&skill.id);

        eprintln!("Agent skills_path: {}", agent.skills_path);
        eprintln!("Link source (central storage): {:?}", link_source);
        eprintln!("Skill target: {:?}", skill_target);

        match self.strategy {
            LinkStrategy::Symlink => {
                eprintln!("Using symlink strategy");
                match create_symlink(&link_source, &skill_target) {
                    Ok(result) => {
                        eprintln!("=== LINK_SKILL_TO_AGENT SUCCESS ===");
                        Ok(result)
                    },
                    Err(e) => {
                        eprintln!("Symlink failed with error: {}", e);
                        // 符号链接失败，降级到复制
                        eprintln!("Falling back to copy strategy for {}", skill.id);
                        let copy_result = create_copy(&link_source, &skill_target);
                        match &copy_result {
                            Ok(_) => eprintln!("=== LINK_SKILL_TO_AGENT SUCCESS (COPY FALLBACK) ==="),
                            Err(e2) => eprintln!("=== LINK_SKILL_TO_AGENT FAILED (COPY ALSO FAILED): {} ===", e2),
                        }
                        copy_result
                    }
                }
            }
            LinkStrategy::Copy => {
                eprintln!("Using copy strategy");
                let copy_result = create_copy(&link_source, &skill_target);
                match &copy_result {
                    Ok(_) => eprintln!("=== LINK_SKILL_TO_AGENT SUCCESS (COPY) ==="),
                    Err(e) => eprintln!("=== LINK_SKILL_TO_AGENT FAILED (COPY): {} ===", e),
                }
                copy_result
            }
        }
    }

    /// 从 Agent 移除技能链接
    pub fn unlink_skill_from_agent(
        &self,
        skill: &SkillMetadata,
        agent: &AgentConfig,
    ) -> Result<(), LinkerError> {
        self.unlink_skill_id_from_agent(&skill.id, agent)
    }

    /// 仅通过 skill ID 移除链接（无需完整 SkillMetadata）
    pub fn unlink_skill_id_from_agent(
        &self,
        skill_id: &str,
        agent: &AgentConfig,
    ) -> Result<(), LinkerError> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| LinkerError::AgentNotFound("Cannot find home directory".to_string()))?;

        // 正确处理 ~/ 前缀
        let agent_path = if agent.path.starts_with("~/") {
            home_dir.join(&agent.path[2..])
        } else if agent.path.starts_with("~") {
            home_dir.join(&agent.path[1..])
        } else {
            home_dir.join(&agent.path)
        };

        let skill_target = agent_path.join(&agent.skills_path).join(skill_id);
        remove_link(&skill_target)
    }

    /// 更新技能在所有 Agent 中的链接状态
    #[allow(dead_code)]
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

