//! Skill 置顶（pin）相关命令：把指定 skill_id 加入/移出 `AppConfig.pinned_skills`。
//!
//! 文件名沿用 `window.rs` 是历史遗留——之前这里放的是窗口级别的 always-on-top 命令，
//! 现在改造成卡片置顶。如果以后再有窗口级命令，可以按需拆分。

use crate::state::AppState;
use tauri::Manager;

/// 设置某个 skill 是否置顶。`pinned=true` 加入列表（重复幂等），`false` 移除。
#[tauri::command]
pub fn set_skill_pinned(
    app: tauri::AppHandle,
    skill_id: String,
    pinned: bool,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut mgr = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    let cfg = mgr.get_config_mut();
    let already = cfg.pinned_skills.iter().any(|s| s == &skill_id);
    match (pinned, already) {
        (true, false) => cfg.pinned_skills.push(skill_id),
        (false, true) => cfg.pinned_skills.retain(|s| s != &skill_id),
        _ => return Ok(()),
    }
    mgr.save().map_err(|e| format!("save config: {}", e))?;
    Ok(())
}

/// 读取已置顶的 skill_id 列表（按用户置顶顺序返回）。
#[tauri::command]
pub fn get_pinned_skills(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let state = app.state::<AppState>();
    let mgr = state
        .settings_manager
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;
    Ok(mgr.get_config().pinned_skills.clone())
}
