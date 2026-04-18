// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod scanner;
mod linker;
mod settings;
mod error;
mod github_scanner;
mod installer;
mod github;

use commands::skills::AppState;
use models::SkillMetadata;
use settings::AppSettingsManager;
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    tray::TrayIconBuilder,
    Manager, Runtime,
};
use tauri_plugin_aptabase::EventTracker;

fn init_sentry() -> Option<sentry::ClientInitGuard> {
    let dsn = std::env::var("SENTRY_DSN").ok()?;
    let dsn = dsn.trim();
    if dsn.is_empty() {
        return None;
    }

    let environment = std::env::var("SENTRY_ENVIRONMENT").ok();
    let guard = sentry::init((
        dsn.to_string(),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            environment: environment.map(Into::into),
            ..Default::default()
        },
    ));
    log::info!("Sentry initialized");
    Some(guard)
}

// 托盘多语言支持
struct TrayTexts {
    show: &'static str,
    quit: &'static str,
    no_skills: &'static str,
}

fn get_tray_texts(lang: &str) -> TrayTexts {
    match lang {
        "zh" | "zh-CN" | "zh-TW" => TrayTexts {
            show: "显示主窗口",
            quit: "退出",
            no_skills: "暂无技能",
        },
        _ => TrayTexts {
            show: "Show Window",
            quit: "Quit",
            no_skills: "No Skills",
        },
    }
}

fn rebuild_tray_menu<R: Runtime, M: Manager<R>>(manager: &M, lang: &str) -> Result<(), Box<dyn std::error::Error>> {
    let app = manager.app_handle();
    let texts = get_tray_texts(lang);

    // 获取技能和配置
    let state = app.state::<AppState>();
    let config = state.settings_manager.lock().unwrap().get_config().clone();
    let skill_states = config.skill_states.clone();
    let agents = config.agents.clone();
    let all_skills = scanner::scan_all_skill_sources(&skill_states, &agents).unwrap_or_default();

    // 与前端 matchesAnyPrefix 一致：大小写不敏感的 id 前缀匹配
    let hide_prefixes: Vec<String> = config
        .skill_hide_prefixes
        .iter()
        .map(|p| p.trim().to_lowercase())
        .filter(|p| !p.is_empty())
        .collect();
    let filtered: Vec<_> = if hide_prefixes.is_empty() {
        all_skills
    } else {
        all_skills
            .into_iter()
            .filter(|s| {
                let lower = s.id.to_lowercase();
                !hide_prefixes.iter().any(|p| lower.starts_with(p))
            })
            .collect()
    };

    // 跨 source 按 id 合并（与 Dashboard 合并视图语义一致）：
    // agent_enabled 做 OR，保留首次出现的元数据作为展示基底，避免同名技能在托盘里重复。
    let skills: Vec<SkillMetadata> = {
        let mut seen: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut merged: Vec<SkillMetadata> = Vec::with_capacity(filtered.len());
        for skill in filtered {
            match seen.get(&skill.id).copied() {
                Some(idx) => {
                    for (agent_name, enabled) in &skill.agent_enabled {
                        if *enabled {
                            merged[idx].agent_enabled.insert(agent_name.clone(), true);
                        }
                    }
                }
                None => {
                    seen.insert(skill.id.clone(), merged.len());
                    merged.push(skill);
                }
            }
        }
        merged
    };

    let mut menu_builder = MenuBuilder::new(app);

    for agent in &config.agents {
        if !agent.detected { continue; }
        let enabled_count = skills.iter()
            .filter(|s| s.agent_enabled.get(&agent.name) == Some(&true))
            .count();

        let submenu = SubmenuBuilder::new(app, &format!("{} ({}/{})", agent.display_name, enabled_count, skills.len()));
        let submenu = if enabled_count == 0 {
            submenu.text("empty", texts.no_skills)
        } else {
            let mut sb = submenu;
            for skill in &skills {
                if skill.agent_enabled.get(&agent.name) != Some(&true) { continue; }
                sb = sb.text(format!("skill-{}-{}", agent.name, skill.id), &skill.name);
            }
            sb
        };
        menu_builder = menu_builder.item(&submenu.build()?);
    }

    let show_item = MenuItem::with_id(app, "show", texts.show, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", texts.quit, true, None::<&str>)?;
    menu_builder = menu_builder.separator().item(&show_item).item(&quit_item);

    let menu = menu_builder.build()?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

// 前端调用：更新托盘语言并持久化
#[tauri::command]
fn update_tray_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    rebuild_tray_menu(&app, &lang).map_err(|e| e.to_string())?;
    // 持久化语言到配置
    let state = app.state::<AppState>();
    if let Ok(mut mgr) = state.settings_manager.lock() {
        let _ = mgr.update_language(&lang);
    }
    Ok(())
}

/// 前端调用：更新 skill 隐藏前缀并重建托盘菜单
#[tauri::command]
fn set_skill_hide_prefixes(app: tauri::AppHandle, prefixes: Vec<String>) -> Result<(), String> {
    let state = app.state::<AppState>();
    let lang = {
        let mut mgr = state
            .settings_manager
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        mgr.set_skill_hide_prefixes(prefixes)
            .map_err(|e| format!("Failed to save skill hide prefixes: {}", e))?;
        mgr.get_config().language.clone()
    };
    rebuild_tray_menu(&app, &lang).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let aptabase_key = std::env::var("APTABASE_APP_KEY").ok().and_then(|key| {
        let trimmed = key.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let aptabase_enabled = aptabase_key.is_some();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

    if let Some(app_key) = aptabase_key {
        builder = builder.plugin(tauri_plugin_aptabase::Builder::new(&app_key).build());
        log::info!("Aptabase initialized");
    }

    let app = builder
        .setup(move |app| {
            // 初始化 AppSettingsManager
            let config_path = AppSettingsManager::get_config_path();
            let settings_manager = AppSettingsManager::load_or_create(&config_path)
                .expect("Failed to initialize AppSettingsManager");

            // 检测 agents 并获取配置
            let config = settings_manager.get_config().clone();
            let skill_states = config.skill_states.clone();
            let agents = config.agents.clone();

            // 扫描技能
            let _skills = scanner::scan_all_skill_sources(&skill_states, &agents)
                .unwrap_or_default();

            // 设置应用状态
            app.manage(AppState {
                settings_manager: Mutex::new(settings_manager),
            });
            if aptabase_enabled {
                let _ = app.handle().track_event("app_started", None);
            }

            // 先构建托盘图标（不设菜单）
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("Skills Manager")
                .show_menu_on_left_click(cfg!(not(target_os = "windows")))
                .on_tray_icon_event(|tray, event| {
                    // Only handle click on Windows to show window
                    #[cfg(target_os = "windows")]
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    // On macOS, let the menu show naturally
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        #[cfg(target_os = "macos")]
                        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                    "quit" => {
                        if let Some(w) = app.get_webview_window("main") {
                            w.destroy().ok();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // 构建并设置托盘菜单（使用用户保存的语言偏好）
            let lang = config.language.clone();
            rebuild_tray_menu(app, &lang)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                let _ = window.app_handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Skills commands
            commands::skills::list_skills,
            commands::skills::enable_skill,
            commands::skills::disable_skill,
            commands::skills::get_skill_content,
            commands::skills::get_skill_files,
            commands::skills::read_skill_file,
            commands::skills::rescan_skills,
            commands::skills::delete_skill,
            commands::skills::import_skill_folder,
            // Settings commands
            commands::settings::get_agents,
            commands::settings::add_agent,
            commands::settings::remove_agent,
            commands::settings::get_config,
            commands::settings::set_linking_strategy,
            commands::settings::open_skills_manager_folder,
            commands::settings::detect_agents,
            commands::settings::open_folder,
            // Marketplace commands
            commands::marketplace::scan_github_repos,
            commands::marketplace::install_from_github,
            commands::marketplace::get_default_repos,
            // GitHub backup commands
            commands::github::test_github_connection,
            commands::github::save_github_config,
            commands::github::get_github_config,
            commands::github::add_github_repo,
            commands::github::remove_github_repo,
            commands::github::list_github_repos,
            commands::github::sync_github_repo,
            commands::github::restore_from_github,
            commands::github::star_github_repo,
            commands::github::check_github_star,
            // Theme commands
            commands::theme::set_window_theme,
            // Tray commands
            update_tray_language,
            set_skill_hide_prefixes,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| {
        if aptabase_enabled {
            match event {
                tauri::RunEvent::Exit { .. } => {
                    let _ = app_handle.track_event("app_exited", None);
                    app_handle.flush_events_blocking();
                }
                tauri::RunEvent::Ready => {
                    let _ = app_handle.track_event("app_ready", None);
                }
                _ => {}
            }
        }
    });
}

#[cfg(not(mobile))]
fn main() {
    // 初始化日志
    env_logger::init();

    log::info!("Skills Manager starting...");
    let _sentry_guard = init_sentry();

    run();
}

#[cfg(test)]
mod models_test;
#[cfg(test)]
mod scanner_test;
#[cfg(test)]
mod linker_test;
#[cfg(test)]
mod settings_test;
