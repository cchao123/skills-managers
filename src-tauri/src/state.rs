use crate::settings::AppSettingsManager;
use std::sync::Mutex;

/// 应用全局状态，通过 Tauri 的 managed state 暴露给所有 command。
pub struct AppState {
    pub settings_manager: Mutex<AppSettingsManager>,
}
