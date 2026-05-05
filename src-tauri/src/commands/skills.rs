use crate::linker::LinkManager;
use crate::models::{AgentConfig, SkillEntry, SkillFileEntry, SkillMetadata, SOURCE_GLOBAL};
use crate::scanner;
use crate::settings::AppSettingsManager;
use crate::state::AppState;
use log::{info, warn};
use regex::Regex;
use std::path::PathBuf;
use tauri::State;

/// 展开路径中的 ~ 为用户主目录
fn expand_tilde_path(path: &str) -> Option<PathBuf> {
    if let Some(rest) = path.strip_prefix("~/") {
        dirs::home_dir().map(|h| h.join(rest))
    } else if path == "~" {
        dirs::home_dir()
    } else {
        Some(PathBuf::from(path))
    }
}

/// 从 SKILL.md 内容中提取 name 字段
fn extract_skill_name_from_md(content: &str) -> Option<String> {
    let re = Regex::new(r"^---\s*\n([\s\S]*?)\n---").ok()?;
    let caps = re.captures(content)?;
    let yaml_content = caps.get(1)?.as_str();
    let yaml: serde_yaml::Value = serde_yaml::from_str(yaml_content).ok()?;
    yaml.get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 扫描并把结果同步回 skill_states（自愈），**不落盘**。
/// 用于需要后续再改 skill_states 的场景（enable/disable/delete/set_primary），
/// 由调用方在末尾统一 save 一次，避免两次 IO。
fn scan_only(
    settings: &mut crate::settings::AppSettingsManager,
) -> Result<Vec<SkillMetadata>, String> {
    let agents = settings.get_config().agents.clone();
    let skill_states = &mut settings.get_config_mut().skill_states;
    scanner::scan_and_merge(skill_states, &agents)
        .map_err(|e| format!("Failed to scan skills: {}", e))
}

/// 扫描 + 立刻落盘。用于单纯读取场景（list_skills / rescan_skills）。
fn scan_and_persist(
    settings: &mut crate::settings::AppSettingsManager,
) -> Result<Vec<SkillMetadata>, String> {
    let skills = scan_only(settings)?;
    settings
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;
    Ok(skills)
}

/// 清空中央存储中指定 skill 的副本。在以下场景调用：
/// - 删除任一源：central 的快照可能来自被删的源，需要重置以便下次重新拷贝
/// - 切换 primary：central 里是旧 primary 的快照，切换后应重新从新 primary 同步
fn clear_central_storage(skill_id: &str) {
    let central = AppSettingsManager::get_skills_dir().join(skill_id);
    if central.exists() {
        if let Err(e) = std::fs::remove_dir_all(&central) {
            warn!("Failed to clear central storage for {}: {}", skill_id, e);
        }
    }
}

/// 列出所有已安装的技能（会触发自愈 + 持久化）
#[tauri::command]
pub async fn list_skills(state: State<'_, AppState>) -> Result<Vec<SkillMetadata>, String> {
    info!("Listing skills from all sources...");

    let mut settings = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills = scan_and_persist(&mut settings)?;
    info!("Found {} skills", skills.len());
    Ok(skills)
}

/// 解析 `skill.path` 对应的"源仓库根目录"，作为 linker 的 `_skills_base`。
/// 新版本里 linker 其实不用这个参数，随便给一个占位即可。
fn dummy_skills_base() -> PathBuf {
    PathBuf::from("~/.skills-manager/skills")
}

/// 查找某个 agent 是否是该 skill 的"原生" agent（物理副本就在它自己目录里）。
fn is_native(entry: &SkillEntry, agent: &str) -> bool {
    entry.sources.iter().any(|s| s == agent)
}

/// 启用技能（全局或特定 Agent）
#[tauri::command]
pub async fn enable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Enabling skill '{}' for agent: {:?}", skill_id, agent);

    let mut settings = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills = scan_only(&mut settings)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let config = settings.get_config().clone();
    let linker = LinkManager::new(config.linking_strategy.clone());
    let skills_base = dummy_skills_base();

    // scan_only 已经保证 skill_states 里有这条记录
    let entry = settings
        .get_config_mut()
        .skill_states
        .get_mut(&skill_id)
        .ok_or_else(|| format!("Skill '{}' missing in skill_states after scan", skill_id))?;

    let target_agents: Vec<AgentConfig> = if let Some(ref a) = agent {
        config
            .agents
            .iter()
            .filter(|ac| &ac.name == a)
            .cloned()
            .collect()
    } else {
        config
            .agents
            .iter()
            .filter(|ac| ac.enabled && ac.detected)
            .cloned()
            .collect()
    };

    if target_agents.is_empty() {
        if let Some(ref a) = agent {
            return Err(format!("Agent '{}' not found", a));
        }
        return Ok(());
    }

    let mut linked = 0usize;
    for agent_config in &target_agents {
        // 原生 Agent：不碰 open，不重复 link
        if is_native(entry, &agent_config.name) {
            continue;
        }
        if !entry.open.iter().any(|n| n == &agent_config.name) {
            entry.open.push(agent_config.name.clone());
        }
        match linker.link_skill_to_agent(&skill, agent_config, &skills_base) {
            Ok(_) => linked += 1,
            Err(e) => warn!("Failed to link to agent {}: {}", agent_config.name, e),
        }
    }

    settings
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;
    info!("Successfully enabled skill for {} agents", linked);
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

    let mut settings = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills = scan_only(&mut settings)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let config = settings.get_config().clone();
    let linker = LinkManager::new(config.linking_strategy.clone());

    let target_agents: Vec<AgentConfig> = if let Some(ref a) = agent {
        config
            .agents
            .iter()
            .filter(|ac| &ac.name == a)
            .cloned()
            .collect()
    } else {
        config
            .agents
            .iter()
            .filter(|ac| ac.enabled && ac.detected)
            .cloned()
            .collect()
    };

    if target_agents.is_empty() {
        if let Some(ref a) = agent {
            return Err(format!("Agent '{}' not found", a));
        }
        return Ok(());
    }

    let entry = match settings.get_config_mut().skill_states.get_mut(&skill_id) {
        Some(e) => e,
        None => return Ok(()),
    };

    let mut unlinked = 0usize;
    for agent_config in &target_agents {
        if is_native(entry, &agent_config.name) {
            warn!(
                "Skipping disable for native agent '{}' on skill '{}'",
                agent_config.name, skill_id
            );
            continue;
        }
        entry.open.retain(|n| n != &agent_config.name);
        match linker.unlink_skill_from_agent(&skill, agent_config) {
            Ok(_) => unlinked += 1,
            Err(e) => warn!(
                "Failed to unlink from agent {}: {}",
                agent_config.name, e
            ),
        }
    }

    settings
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;
    info!("Successfully disabled skill for {} agents", unlinked);
    Ok(())
}

/// 设置技能的 `primary`（链接到非原生 Agent 时所用的源副本）。
/// 切换时会把现有 `open` Agent 重新 unlink + link。
#[tauri::command]
pub async fn set_skill_primary(
    skill_id: String,
    new_primary: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Setting primary for '{}' → '{}'", skill_id, new_primary);

    let mut settings = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let skills = scan_only(&mut settings)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    if !skill.sources.iter().any(|s| s == &new_primary) {
        return Err(format!(
            "Source '{}' is not in skill '{}' sources: {:?}",
            new_primary, skill_id, skill.sources
        ));
    }

    // primary 没变：什么都不用做
    if skill.primary == new_primary {
        return Ok(());
    }

    let config = settings.get_config().clone();
    let linker = LinkManager::new(config.linking_strategy.clone());
    let skills_base = dummy_skills_base();

    // 1. 先按旧 primary 把 open Agent 全部 unlink
    for agent_name in &skill.open {
        if let Some(agent_config) = config.agents.iter().find(|a| &a.name == agent_name) {
            if let Err(e) = linker.unlink_skill_from_agent(&skill, agent_config) {
                warn!("unlink before repoint failed for {}: {}", agent_name, e);
            }
        }
    }

    // 2. 清中央缓存：让 link 时能从新 primary 重新拷贝一份。
    //    但若 global 在 sources 里，中央目录本身就是 global 源本体，不能清——
    //    此时 linker 链接到的始终是 global（canonical），新 primary 只影响元数据展示
    //    （primary 字段会保留，但物理链接还是指向 global 源，这是符合预期的）。
    let has_global = skill.sources.iter().any(|s| s == SOURCE_GLOBAL);
    if !has_global {
        clear_central_storage(&skill_id);
    }

    // 3. 改 primary
    {
        let entry = settings
            .get_config_mut()
            .skill_states
            .get_mut(&skill_id)
            .ok_or_else(|| format!("Skill '{}' missing in skill_states", skill_id))?;
        entry.primary = new_primary;
    }

    // 4. 重新扫描拿到新的 skill.path（primary 变了），再 link
    let skills = scan_only(&mut settings)?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found after repoint", skill_id))?;

    for agent_name in skill.open.clone() {
        if let Some(agent_config) = config.agents.iter().find(|a| a.name == agent_name) {
            if let Err(e) = linker.link_skill_to_agent(&skill, agent_config, &skills_base) {
                warn!("relink after repoint failed for {}: {}", agent_name, e);
            }
        }
    }

    settings
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;
    Ok(())
}

/// 获取技能内容（始终读中央存储里的 SKILL.md）
#[tauri::command]
pub async fn get_skill_content(
    skill_id: String,
    _state: State<'_, AppState>,
) -> Result<String, String> {
    let skills_dir = AppSettingsManager::get_skills_dir();
    let skill_md = skills_dir.join(&skill_id).join("SKILL.md");

    std::fs::read_to_string(&skill_md).map_err(|e| format!("Failed to read skill content: {}", e))
}

/// 获取技能文件目录
///
/// `source` 参数保留用于选择读哪个物理副本（前端"查看某来源的文件"）。
#[tauri::command]
pub async fn get_skill_files(
    skill_id: String,
    source: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SkillFileEntry>, String> {
    info!("Getting files for skill: {} (source: {:?})", skill_id, source);

    let guard = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    let config = guard.get_config();
    let skills = scanner::scan_all_skill_sources(&config.skill_states, &config.agents)
        .map_err(|e| format!("Failed to scan skills: {}", e))?;

    let skill = skills
        .iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    // 优先用 source 参数对应的物理路径；否则用 primary 对应的路径
    let source_key = source.as_deref().unwrap_or(skill.primary.as_str());
    let skill_path = skill
        .source_paths
        .get(source_key)
        .cloned()
        .ok_or_else(|| "Skill has no path".to_string())?;

    fn scan_dir(path: &std::path::Path) -> Result<SkillFileEntry, String> {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read metadata: {}", e))?;

        if path.is_dir() {
            let mut children = Vec::new();
            let mut entries: Vec<_> = std::fs::read_dir(path)
                .map_err(|e| format!("Failed to read directory: {}", e))?
                .filter_map(|e| e.ok())
                .collect();

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

    let path = std::path::Path::new(&skill_path);
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
    source: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let guard = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    let config = guard.get_config();
    let skills = scanner::scan_all_skill_sources(&config.skill_states, &config.agents)
        .map_err(|e| format!("Failed to scan skills: {}", e))?;

    let skill = skills
        .iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    let source_key = source.as_deref().unwrap_or(skill.primary.as_str());
    let base_path = skill
        .source_paths
        .get(source_key)
        .cloned()
        .ok_or_else(|| "Skill has no path".to_string())?;

    let requested_path = std::path::Path::new(&file_path);
    let base_path = std::path::Path::new(&base_path);

    if !requested_path.starts_with(base_path) {
        return Err("Access denied: file is outside skill directory".to_string());
    }

    std::fs::read_to_string(requested_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// 重新扫描技能目录
#[tauri::command]
pub async fn rescan_skills(state: State<'_, AppState>) -> Result<Vec<SkillMetadata>, String> {
    info!("Rescanning skills directory...");
    list_skills(state).await
}

/// 删除技能：
/// - 若指定 `source`：只删除该物理副本 + 从 `SkillEntry.sources` 摘除
/// - 若未指定 `source`：删除所有物理副本
///
/// 无论哪种模式，都会：
/// 1. 把 `entry.open` 里所有 agent 全部 unlink（否则 symlink 会悬挂）
/// 2. 清中央存储里的副本（它可能是被删源的快照；下次用户 re-enable 再从新 primary 拷贝）
/// 3. 清空 `entry.open`（避免脏状态）
/// 4. 更新 / 删除 `skill_states` 记录
#[tauri::command]
pub async fn delete_skill(
    skill_id: String,
    source: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Deleting skill: {} (source: {:?})", skill_id, source);

    let (source_paths_to_delete, open_agents, agents, linking_strategy, will_have_global) = {
        let guard = state
            .settings_manager
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        let config = guard.get_config();

        let skills = scanner::scan_all_skill_sources(&config.skill_states, &config.agents)
            .map_err(|e| format!("Failed to scan skills: {}", e))?;

        let skill = skills
            .into_iter()
            .find(|s| s.id == skill_id)
            .ok_or_else(|| format!("技能 '{}' 未找到", skill_id))?;

        let to_delete: Vec<(String, String)> = if let Some(src) = source.as_ref() {
            skill
                .source_paths
                .iter()
                .filter(|(s, _)| s.as_str() == src.as_str())
                .map(|(s, p)| (s.clone(), p.clone()))
                .collect()
        } else {
            skill
                .source_paths
                .iter()
                .map(|(s, p)| (s.clone(), p.clone()))
                .collect()
        };

        // 删除完成后还会剩哪些源？用来决定能不能清中央缓存。
        let will_have_global = match source.as_deref() {
            Some(SOURCE_GLOBAL) => false,          // 就是删 global
            None => false,                          // 整体删除
            Some(_) => skill.sources.iter().any(|s| s == SOURCE_GLOBAL), // 删别的源但 global 还在
        };

        (
            to_delete,
            skill.open.clone(),
            config.agents.clone(),
            config.linking_strategy.clone(),
            will_have_global,
        )
    };

    // 无论删除哪个源，都 unlink 所有 open agent + 删物理副本
    let skill_id_clone = skill_id.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let linker = LinkManager::new(linking_strategy);

        for agent_name in &open_agents {
            if let Some(agent_config) = agents.iter().find(|a| &a.name == agent_name) {
                if let Err(e) = linker.unlink_skill_id_from_agent(&skill_id_clone, agent_config) {
                    warn!(
                        "Failed to unlink skill from agent {}: {}",
                        agent_config.name, e
                    );
                }
            }
        }

        for (_src, path) in &source_paths_to_delete {
            let p = std::path::Path::new(path);
            if p.exists() {
                std::fs::remove_dir_all(p)
                    .map_err(|e| format!("删除技能目录失败 {:?}: {}", p, e))?;
                info!("Skill directory deleted: {:?}", p);
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    // 中央目录 `~/.skills-manager/skills/<id>` 有双重角色：
    // - 当 global ∈ sources：它**就是** global 源本身，清理会破坏数据
    // - 当 global ∉ sources：它只是某个非 global primary 的链接缓存，清理是安全且必要的
    // 所以只有在 "删完后 global 已经不在 sources" 的情况下才清中央缓存。
    // 另外：如果是删 global 源本身或整体删除，`remove_dir_all` 的循环其实已经
    // 把中央目录 remove 掉了，这里再调一次也是幂等 no-op。
    if !will_have_global {
        clear_central_storage(&skill_id);
    }

    // 更新 skill_states
    {
        let mut settings = state
            .settings_manager
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        if let Some(src) = source.as_ref() {
            if let Some(entry) = settings.get_config_mut().skill_states.get_mut(&skill_id) {
                entry.sources.retain(|s| s != src);
                // primary 若指向被删源，ensure_valid_primary 会按优先级挑新的
                if entry.primary == *src {
                    entry.primary = String::new();
                }
                entry.ensure_valid_primary();
                // 不论是否还有其它源，都清空 open：中央存储已重置，必须让用户主动重新 enable
                entry.open.clear();
                if entry.is_orphan() {
                    settings.get_config_mut().skill_states.remove(&skill_id);
                }
            }
        } else {
            settings.get_config_mut().skill_states.remove(&skill_id);
        }

        settings.save().map_err(|e| format!("保存配置失败: {}", e))?;
    }

    info!("Skill '{}' deleted successfully", skill_id);
    Ok(())
}

/// 导入技能文件夹（从外部路径复制到中央存储）
///
/// 目录冲突策略：
/// - 目标不存在：直接拷贝
/// - 目标存在但是"空壳"（无 SKILL.md）：自动清理后拷贝，修复历史残留
/// - 目标存在且有 SKILL.md：视为真实技能，拒绝覆盖，返回带路径的错误
#[tauri::command]
pub async fn import_skill_folder(folder_path: String) -> Result<String, String> {
    let source = std::path::Path::new(&folder_path);

    if !source.exists() || !source.is_dir() {
        return Err("指定路径不存在或不是文件夹".to_string());
    }

    let skill_md = source.join("SKILL.md");
    if !skill_md.exists() {
        return Err("文件夹中没有找到 SKILL.md 文件，无法识别为有效技能".to_string());
    }

    let content =
        std::fs::read_to_string(&skill_md).map_err(|e| format!("读取 SKILL.md 失败: {}", e))?;

    let skill_name = extract_skill_name_from_md(&content).unwrap_or_else(|| {
        source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    });

    let skills_dir = AppSettingsManager::get_skills_dir();
    std::fs::create_dir_all(&skills_dir).map_err(|e| format!("创建技能目录失败: {}", e))?;

    let target = skills_dir.join(&skill_name);
    if target.exists() {
        let target_skill_md = target.join("SKILL.md");
        if target_skill_md.exists() {
            return Err(format!(
                "根目录中已存在技能 '{}'（路径: {}），请先删除再导入",
                skill_name,
                target.display()
            ));
        }
        // 空壳 / 残缺目录：没 SKILL.md，直接清理掉避免死锁
        info!(
            "Target '{}' exists but is empty/corrupted, auto-cleaning before import",
            target.display()
        );
        std::fs::remove_dir_all(&target)
            .map_err(|e| format!("清理残缺目录失败: {} ({})", target.display(), e))?;
    }

    copy_dir_recursive(source, &target).map_err(|e| format!("复制文件夹失败: {}", e))?;

    info!(
        "Imported skill folder '{}' to {:?} (skill name: {})",
        folder_path, target, skill_name
    );
    Ok(skill_name)
}

pub fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
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

/// 复制技能到目标 Agent
///
/// 将指定技能从源 Agent 复制到目标 Agent 的 skills 目录
#[tauri::command]
pub async fn copy_skill_to_agent(
    skill_id: String,
    source_agent: String,
    target_agent: String,
    default_enabled: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut settings = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    // 先扫描获取技能的完整元数据
    let skills = scan_only(&mut settings)?;

    // 查找技能
    let skill = skills
        .iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    // 获取源路径
    let source_path = skill
        .source_paths
        .get(&source_agent)
        .ok_or_else(|| format!("Skill '{}' has no path for agent '{}'", skill_id, source_agent))?;

    let source_path_buf = PathBuf::from(source_path);
    if !source_path_buf.exists() {
        return Err(format!("Source path does not exist: {}", source_path));
    }

    // 获取目标 Agent 配置
    let target_agent_config = settings
        .get_config()
        .agents
        .iter()
        .find(|a| a.name == target_agent)
        .ok_or_else(|| format!("Target agent '{}' not found", target_agent))?;

    // 构建目标路径
    let target_agent_path = expand_tilde_path(&target_agent_config.path)
        .ok_or_else(|| format!("Failed to expand path for agent '{}'", target_agent))?;
    let target_skills_dir = target_agent_path.join(&target_agent_config.skills_path);

    // 确保目标目录存在
    std::fs::create_dir_all(&target_skills_dir)
        .map_err(|e| format!("Failed to create target skills directory: {}", e))?;

    // 构建目标技能路径
    let target_skill_path = target_skills_dir.join(&skill.id);

    // 检查目标是否已存在
    if target_skill_path.exists() {
        return Err(format!(
            "Skill '{}' already exists in agent '{}', please delete it first",
            skill.name, target_agent
        ));
    }

    // 复制技能目录
    copy_dir_recursive(&source_path_buf, &target_skill_path)
        .map_err(|e| format!("Failed to copy skill directory: {}", e))?;

    info!(
        "Copied skill '{}' from '{}' to '{}' (path: {:?})",
        skill.name, source_agent, target_agent, target_skill_path
    );

    // 如果需要默认启用，则启用技能
    if default_enabled {
        // 释放锁后再调用 enable_skill，避免死锁
        drop(settings);

        // 调用启用逻辑
        let mut settings = state
            .settings_manager
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        enable_skill_internal(skill_id.clone(), Some(target_agent.clone()), &mut settings)?;

        info!(
            "Enabled skill '{}' for agent '{}' after copy",
            skill.name, target_agent
        );
    }

    Ok(skill.name.clone())
}

/// 内部启用技能逻辑（避免重复代码）
fn enable_skill_internal(
    skill_id: String,
    agent: Option<String>,
    settings: &mut crate::settings::AppSettingsManager,
) -> Result<(), String> {
    // 先收集需要启用的 agents
    let target_agents = {
        let config = settings.get_config();
        if let Some(agent_name) = agent {
            vec![agent_name]
        } else {
            // 如果没有指定 agent，则启用到所有已配置的 agents
            config
                .agents
                .iter()
                .filter(|a| a.enabled)
                .map(|a| a.name.clone())
                .collect()
        }
    };

    for agent_name in target_agents {
        // 检查 agent 是否启用
        let agent_enabled = {
            let config = settings.get_config();
            let agent_config = config
                .agents
                .iter()
                .find(|a| a.name == agent_name)
                .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;
            agent_config.enabled
        };

        if !agent_enabled {
            warn!("Agent '{}' is not enabled, skipping", agent_name);
            continue;
        }

        // 添加到 open 列表
        let skill_states = &mut settings.get_config_mut().skill_states;
        let skill_state = skill_states
            .get_mut(&skill_id)
            .ok_or_else(|| format!("Skill '{}' not found in states", skill_id))?;

        // 添加到 open 列表
        if !skill_state.open.contains(&agent_name) {
            skill_state.open.push(agent_name.clone());
        }

        info!("Enabled skill '{}' for agent '{}'", skill_id, agent_name);
    }

    settings
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;

    Ok(())
}
