//! 系统托盘菜单：语言文案、菜单构建、前端调用的托盘命令。

use crate::models::SkillMetadata;
use crate::scanner;
use crate::state::AppState;
use tauri::{
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    Manager, Runtime,
};

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

/// 根据当前配置与技能状态，重建托盘菜单。
pub fn rebuild_tray_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    lang: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = manager.app_handle();
    let texts = get_tray_texts(lang);

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
        if !agent.detected {
            continue;
        }
        let enabled_count = skills
            .iter()
            .filter(|s| s.agent_enabled.get(&agent.name) == Some(&true))
            .count();

        let submenu = SubmenuBuilder::new(
            app,
            &format!(
                "{} ({}/{})",
                agent.display_name,
                enabled_count,
                skills.len()
            ),
        );
        let submenu = if enabled_count == 0 {
            submenu.text("empty", texts.no_skills)
        } else {
            let mut sb = submenu;
            for skill in &skills {
                if skill.agent_enabled.get(&agent.name) != Some(&true) {
                    continue;
                }
                sb = sb.text(
                    format!("skill-{}-{}", agent.name, skill.id),
                    &skill.name,
                );
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

/// 前端调用：更新托盘语言并持久化。
#[tauri::command]
pub fn update_tray_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    rebuild_tray_menu(&app, &lang).map_err(|e| e.to_string())?;
    let state = app.state::<AppState>();
    if let Ok(mut mgr) = state.settings_manager.lock() {
        let _ = mgr.update_language(&lang);
    }
    Ok(())
}

/// 前端调用：更新 skill 隐藏前缀并重建托盘菜单。
#[tauri::command]
pub fn set_skill_hide_prefixes(
    app: tauri::AppHandle,
    prefixes: Vec<String>,
) -> Result<(), String> {
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
