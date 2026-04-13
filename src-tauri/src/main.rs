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
use settings::AppSettingsManager;
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    tray::TrayIconBuilder,
    Manager, Runtime,
};

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
    let skills = scanner::scan_all_skill_sources(&skill_states, &agents).unwrap_or_default();

    let mut menu_builder = MenuBuilder::new(app);

    for agent in &config.agents {
        if !agent.detected { continue; }
        let enabled_count = skills.iter()
            .filter(|s| s.agent_enabled.get(&agent.name) == Some(&true))
            .count();

        let submenu = SubmenuBuilder::new(app, &format!("{} ({}/{})", agent.display_name, enabled_count, skills.len()));
        let submenu = if skills.is_empty() {
            submenu.text("empty", texts.no_skills)
        } else {
            let mut sb = submenu;
            for skill in &skills {
                let is_enabled = skill.agent_enabled.get(&agent.name) == Some(&true);
                let label = if is_enabled { format!("✓ {}", skill.name) } else { format!("  {}", skill.name) };
                sb = sb.text(format!("skill-{}-{}", agent.name, skill.id), &label);
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
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
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}

#[cfg(not(mobile))]
fn main() {
    // 初始化日志
    env_logger::init();

    log::info!("Skills Manager starting...");

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
