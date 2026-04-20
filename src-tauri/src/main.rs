// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod github;
mod linker;
mod models;
mod scanner;
mod settings;
mod state;
mod tray;

use settings::AppSettingsManager;
use state::AppState;
use std::sync::Mutex;
use tauri::{tray::TrayIconBuilder, Manager};

fn load_env_for_runtime() {
    // Load common .env files for local development. CI env vars still take precedence.
    let candidates = [
        ".env",
        ".env.local",
        "../.env",
        "../.env.local",
        "src-tauri/.env",
        "src-tauri/.env.local",
    ];

    for path in candidates {
        let _ = dotenvy::from_filename_override(path);
    }
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

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

            // 预热一次扫描，捕获潜在 IO 异常。
            let _skills = scanner::scan_all_skill_sources(&skill_states, &agents)
                .unwrap_or_default();

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
            tray::rebuild_tray_menu(app, &lang)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                let _ = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
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
            // GitHub backup commands
            commands::github::test_github_connection,
            commands::github::save_github_config,
            commands::github::get_github_config,
            commands::github::sync_github_repo,
            commands::github::restore_from_github,
            commands::github::star_github_repo,
            commands::github::check_github_star,
            // Theme commands
            commands::theme::set_window_theme,
            // Tray commands
            tray::update_tray_language,
            tray::set_skill_hide_prefixes,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, _event| {
        // 事件处理
    });
}

#[cfg(not(mobile))]
fn main() {
    env_logger::init();
    load_env_for_runtime();

    log::info!("Skills Manager starting...");
    let _sentry_guard = init_sentry();

    run();
}

#[cfg(test)]
mod tests;
