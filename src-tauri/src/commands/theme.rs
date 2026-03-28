#[tauri::command]
pub fn set_window_theme(theme: &str, window: tauri::Window) -> Result<(), String> {
    use tauri::utils::Theme;

    let tauri_theme = match theme {
        "dark" => Theme::Dark,
        _ => Theme::Light,
    };

    window
        .set_theme(Some(tauri_theme))
        .map_err(|e| e.to_string())?;

    Ok(())
}
