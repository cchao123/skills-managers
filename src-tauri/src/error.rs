use thiserror::Error;

/// Skills Manager 统一错误类型
#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum SkillsManagerError {
    #[error("Scanner error: {0}")]
    Scanner(#[from] crate::scanner::ScannerError),

    #[error("Linker error: {0}")]
    Linker(#[from] crate::linker::LinkerError),

    #[error("Settings error: {0}")]
    Settings(#[from] crate::settings::AppSettingsError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl serde::Serialize for SkillsManagerError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
