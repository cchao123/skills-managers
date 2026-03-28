use crate::linker::LinkManager;
use crate::models::{SkillMetadata, SkillSource, SkillFileEntry};
use crate::scanner;
use crate::settings::AppSettingsManager;
use log::{info, error, warn};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// 应用状态
pub struct AppState {
    pub settings_manager: Mutex<AppSettingsManager>,
}

/// 根据技能来源获取基础路径
fn get_skill_base_path(source: &SkillSource) -> PathBuf {
    match source {
        SkillSource::Central => {
            PathBuf::from("~/.skills-manager/skills")
        }
        SkillSource::Cursor => {
            PathBuf::from("~/.cursor/skills")
        }
        SkillSource::Claude => {
            PathBuf::from("~/.claude/plugins/cache")
        }
    }
}

/// 列出所有已安装的技能
#[tauri::command]
pub async fn list_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    info!("Listing skills from all sources...");

    let settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let config = settings.get_config();
    info!("Scanning skills from central, cursor, and claude sources...");

    let skills = scanner::scan_all_skill_sources(&config.skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    info!("Found {} skills", skills.len());
    Ok(skills)
}

/// 启用技能（全局或特定 Agent）
#[tauri::command]
pub async fn enable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Enabling skill '{}' for agent: {:?}", skill_id, agent);

    let mut settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let skills = scanner::scan_all_skill_sources(&settings.get_config().skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    let skill = skills.into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    let config = settings.get_config().clone();
    let linker = LinkManager::new(config.linking_strategy);

    // 获取技能的基础路径
    let skill_base = get_skill_base_path(&skill.source);

    if let Some(agent_name) = agent {
        // 启用特定 Agent
        info!("Enabling skill for specific agent: {}", agent_name);
        let agent_config = config.agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| {
                error!("Agent '{}' not found", agent_name);
                format!("Agent '{}' not found", agent_name)
            })?;

        // 更新配置中的状态
        eprintln!("Setting skill_states[{}][{}] = true", skill_id, agent_name);
        settings.get_config_mut()
            .skill_states
            .entry(skill_id.clone())
            .or_insert_with(HashMap::new)
            .insert(agent_name.clone(), true);

        eprintln!("Saving config...");
        settings.save()
            .map_err(|e| {
                error!("Failed to save config: {}", e);
                format!("Failed to save config: {}", e)
            })?;

        eprintln!("Config saved successfully");

        linker.link_skill_to_agent(&skill, agent_config, &skill_base)
            .map_err(|e| {
                error!("Failed to link skill: {}", e);
                format!("Failed to link skill: {}", e)
            })?;
    } else {
        // 全局启用
        info!("Enabling skill globally for all agents");
        let mut enabled_count = 0;

        let config = settings.get_config().clone();

        for agent_config in &config.agents {
            if agent_config.enabled {
                settings.get_config_mut()
                    .skill_states
                    .entry(skill_id.clone())
                    .or_insert_with(HashMap::new)
                    .insert(agent_config.name.clone(), true);

                match linker.link_skill_to_agent(&skill, agent_config, &skill_base) {
                    Ok(_) => enabled_count += 1,
                    Err(e) => warn!("Failed to link to agent {}: {}", agent_config.name, e),
                }
            }
        }

        settings.save()
            .map_err(|e| {
                error!("Failed to save config: {}", e);
                format!("Failed to save config: {}", e)
            })?;

        info!("Successfully enabled skill for {} agents", enabled_count);
    }

    Ok(())
}

/// 禁用技能（全局或特定 Agent）
#[tauri::command]
pub async fn disable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Disabling skill '{}' for agent: {:?}", skill_id, agent);

    let mut settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let skills = scanner::scan_all_skill_sources(&settings.get_config().skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    let skill = skills.into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    let config = settings.get_config().clone();
    let linker = LinkManager::new(config.linking_strategy);

    if let Some(agent_name) = agent {
        // 禁用特定 Agent
        info!("Disabling skill for specific agent: {}", agent_name);
        let agent_config = config.agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| {
                error!("Agent '{}' not found", agent_name);
                format!("Agent '{}' not found", agent_name)
            })?;

        // 更新配置中的状态
        settings.get_config_mut()
            .skill_states
            .entry(skill_id.clone())
            .or_insert_with(HashMap::new)
            .insert(agent_name.clone(), false);

        settings.save()
            .map_err(|e| {
                error!("Failed to save config: {}", e);
                format!("Failed to save config: {}", e)
            })?;

        linker.unlink_skill_from_agent(&skill, agent_config)
            .map_err(|e| {
                error!("Failed to unlink skill: {}", e);
                format!("Failed to unlink skill: {}", e)
            })?;
    } else {
        // 全局禁用
        info!("Disabling skill globally for all agents");
        let mut disabled_count = 0;

        let config = settings.get_config().clone();

        for agent_config in &config.agents {
            if agent_config.enabled {
                settings.get_config_mut()
                    .skill_states
                    .entry(skill_id.clone())
                    .or_insert_with(HashMap::new)
                    .insert(agent_config.name.clone(), false);

                match linker.unlink_skill_from_agent(&skill, agent_config) {
                    Ok(_) => disabled_count += 1,
                    Err(e) => warn!("Failed to unlink from agent {}: {}", agent_config.name, e),
                }
            }
        }

        settings.save()
            .map_err(|e| {
                error!("Failed to save config: {}", e);
                format!("Failed to save config: {}", e)
            })?;

        info!("Successfully disabled skill for {} agents", disabled_count);
    }

    Ok(())
}

/// 获取技能内容
#[tauri::command]
pub async fn get_skill_content(
    skill_id: String,
    _state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Reading content for skill: {}", skill_id);

    let skills_dir = AppSettingsManager::get_skills_dir();
    let skill_md = skills_dir.join(&skill_id).join("SKILL.md");

    info!("Reading skill file: {:?}", skill_md);
    std::fs::read_to_string(&skill_md)
        .map_err(|e| {
            error!("Failed to read skill content: {}", e);
            format!("Failed to read skill content: {}", e)
        })
}

/// 获取技能文件目录
#[tauri::command]
pub async fn get_skill_files(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<SkillFileEntry>, String> {
    info!("Getting files for skill: {}", skill_id);

    // 首先扫描技能获取其路径
    let skills = scanner::scan_all_skill_sources(&state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .get_config()
        .skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    let skill = skills.iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    let skill_path = skill.path.as_ref()
        .ok_or_else(|| "Skill has no path".to_string())?;

    info!("Scanning directory: {:?}", skill_path);

    // 递归扫描目录
    fn scan_dir(path: &std::path::Path) -> Result<SkillFileEntry, String> {
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let metadata = std::fs::metadata(path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        if path.is_dir() {
            let mut children = Vec::new();
            let mut entries: Vec<_> = std::fs::read_dir(path)
                .map_err(|e| format!("Failed to read directory: {}", e))?
                .filter_map(|e| e.ok())
                .collect();

            // 排序：目录在前，文件在后
            entries.sort_by(|a, b| {
                let a_is_dir = a.path().is_dir();
                let b_is_dir = b.path().is_dir();
                if a_is_dir && !b_is_dir {
                    std::cmp::Ordering::Less
                } else if !a_is_dir && b_is_dir {
                    std::cmp::Ordering::Greater
                } else {
                    a.file_name().cmp(&b.file_name())
                }
            });

            for entry in entries {
                let entry_path = entry.path();
                // 跳过隐藏文件和DS_Store
                if let Some(file_name) = entry_path.file_name() {
                    let name_str = file_name.to_string_lossy();
                    if name_str.starts_with('.') || name_str == "DS_Store" || name_str == "node_modules" {
                        continue;
                    }
                }
                children.push(scan_dir(&entry_path)?);
            }

            Ok(SkillFileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                size: None,
                children: Some(children),
            })
        } else {
            Ok(SkillFileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                size: Some(metadata.len()),
                children: None,
            })
        }
    }

    let path = std::path::Path::new(skill_path);
    if !path.exists() {
        return Ok(Vec::new());
    }

    scan_dir(path).map(|entry| vec![entry])
}

/// 读取技能目录中的任意文件
#[tauri::command]
pub async fn read_skill_file(
    skill_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Reading file {} for skill: {}", file_path, skill_id);

    // 验证文件路径是否在技能目录内
    let skills = scanner::scan_all_skill_sources(&state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .get_config()
        .skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    let skill = skills.iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    let skill_path = skill.path.as_ref()
        .ok_or_else(|| "Skill has no path".to_string())?;

    let requested_path = std::path::Path::new(&file_path);
    let base_path = std::path::Path::new(skill_path);

    // 安全检查：确保请求的文件在技能目录内
    if !requested_path.starts_with(base_path) {
        return Err("Access denied: file is outside skill directory".to_string());
    }

    std::fs::read_to_string(requested_path)
        .map_err(|e| {
            error!("Failed to read file: {}", e);
            format!("Failed to read file: {}", e)
        })
}

/// 重新扫描技能目录
#[tauri::command]
pub async fn rescan_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    info!("Rescanning skills directory...");
    let result = list_skills(state).await;
    match &result {
        Ok(skills) => info!("Rescan complete: found {} skills", skills.len()),
        Err(e) => error!("Rescan failed: {}", e),
    }
    result
}

/// 删除技能（从中央存储）
#[tauri::command]
pub async fn delete_skill(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Deleting skill: {}", skill_id);

    // 获取技能列表并查找目标技能
    let skills = scanner::scan_all_skill_sources(&state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .get_config()
        .skill_states)
        .map_err(|e| {
            error!("Failed to scan skills: {}", e);
            format!("Failed to scan skills: {}", e)
        })?;

    let skill = skills.iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    // 检查是否为中央存储技能
    if skill.source != SkillSource::Central {
        let source_name = match skill.source {
            SkillSource::Claude => "Claude插件",
            SkillSource::Cursor => "Cursor",
            SkillSource::Central => "中央存储",
        };
        return Err(format!("只能删除中央存储中的技能。此技能来源：{}", source_name));
    }

    // 删除中央存储中的技能文件
    let skill_path = skill.path.as_ref()
        .ok_or_else(|| "Skill has no path".to_string())?;

    info!("Deleting skill from: {:?}", skill_path);

    // 删除技能目录
    if std::path::Path::new(skill_path).exists() {
        std::fs::remove_dir_all(skill_path)
            .map_err(|e| {
                error!("Failed to delete skill directory: {}", e);
                format!("Failed to delete skill directory: {}", e)
            })?;
        info!("Skill directory deleted: {:?}", skill_path);
    }

    // 获取配置和创建 linker（在独立的作用域中）
    let (linking_strategy, agents) = {
        let settings_manager = state.settings_manager.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        let config = settings_manager.get_config();
        (config.linking_strategy.clone(), config.agents.clone())
    };

    // 移除所有符号链接
    let linker = LinkManager::new(linking_strategy);
    for agent_config in &agents {
        if agent_config.enabled {
            // 尝试移除链接（忽略错误）
            let _ = linker.unlink_skill_from_agent(&skill, agent_config);
        }
    }

    // 清理配置文件中的状态
    {
        let mut settings = state.settings_manager.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        settings.get_config_mut()
            .skill_states
            .remove(&skill_id);

        settings.save()
            .map_err(|e| {
                error!("Failed to save config: {}", e);
                format!("Failed to save config: {}", e)
            })?;
    }

    info!("Skill '{}' deleted successfully", skill_id);
    Ok(())
}

/// 导入技能文件夹（从外部路径复制到中央存储）
#[tauri::command]
pub async fn import_skill_folder(
    folder_path: String,
) -> Result<String, String> {
    let source = std::path::Path::new(&folder_path);

    if !source.exists() || !source.is_dir() {
        return Err("指定路径不存在或不是文件夹".to_string());
    }

    let skill_md = source.join("SKILL.md");
    if !skill_md.exists() {
        return Err("文件夹中没有找到 SKILL.md 文件，无法识别为有效技能".to_string());
    }

    let folder_name = source.file_name()
        .and_then(|n| n.to_str())
        .ok_or("无法读取文件夹名")?
        .to_string();

    let skills_dir = AppSettingsManager::get_skills_dir();
    std::fs::create_dir_all(&skills_dir).map_err(|e| format!("创建技能目录失败: {}", e))?;

    let target = skills_dir.join(&folder_name);
    if target.exists() {
        return Err(format!("技能 '{}' 已存在，请先删除再导入", folder_name));
    }

    copy_dir_recursive(source, &target)
        .map_err(|e| format!("复制文件夹失败: {}", e))?;

    info!("Imported skill folder '{}' to {:?}", folder_name, target);
    Ok(folder_name)
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}
