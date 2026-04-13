use crate::models::{AgentConfig, AppConfig, LinkStrategy};
use crate::settings::AppSettingsManager;
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
    let skills_dir = AppSettingsManager::get_skills_manager_dir();

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

/// 在系统文件管理器中打开指定目录
#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("目录不存在: {}", path.display()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

/// 检测系统中的 Agent
#[tauri::command]
pub async fn detect_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConfig>, String> {
    eprintln!("=== detect_agents command called ===");

    let mut settings = state.settings_manager.lock()
        .map_err(|e| {
            eprintln!("Failed to acquire lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    eprintln!("Before detection:");
    for agent in &settings.get_config().agents {
        eprintln!("  {} detected: {}", agent.name, agent.detected);
    }

    let count = settings.detect_agents()
        .map_err(|e| {
            eprintln!("Detection failed: {}", e);
            format!("Failed to detect agents: {}", e)
        })?;

    eprintln!("Detected {} agents", count);

    settings.save()
        .map_err(|e| {
            eprintln!("Failed to save config: {}", e);
            format!("Failed to save config: {}", e)
        })?;

    eprintln!("After detection:");
    for agent in &settings.get_config().agents {
        eprintln!("  {} detected: {}", agent.name, agent.detected);
    }

    let agents = settings.get_config().agents.clone();
    eprintln!("Returning {} agents", agents.len());

    Ok(agents)
}
