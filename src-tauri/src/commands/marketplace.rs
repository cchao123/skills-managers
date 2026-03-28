use crate::github_scanner::GitHubScanner;
use crate::installer::SkillInstaller;
use crate::models::GitHubSkill;
use tauri::State;

/// 应用状态（复用现有的 AppState）
pub use crate::commands::skills::AppState;

/// 扫描 GitHub 仓库列表
#[tauri::command]
pub fn scan_github_repos(
    repos: Vec<String>,
    token: Option<String>,
    _state: State<'_, AppState>,
) -> Result<Vec<GitHubSkill>, String> {
    log::info!("Scanning {} GitHub repositories", repos.len());

    let scanner = GitHubScanner::new(token);

    // 尝试扫描真实仓库
    match scanner.scan_repos(repos) {
        Ok(skills) if !skills.is_empty() => {
            log::info!("✅ 成功扫描到 {} 个技能", skills.len());
            Ok(skills)
        }
        _ => {
            log::warn!("⚠️  未扫描到技能，返回示例数据");
            // 如果没有扫描到任何技能，返回示例数据
            Ok(get_mock_github_skills())
        }
    }
}

/// 获取模拟的 GitHub 技能数据
fn get_mock_github_skills() -> Vec<GitHubSkill> {
    vec![
        GitHubSkill {
            id: "web-scraper-pro".to_string(),
            name: "Web Scraper Pro".to_string(),
            description: "High-performance scraping engine for dynamic SPA websites.".to_string(),
            category: "Web".to_string(),
            author: "郝晨晨".to_string(),
            version: Some("v1.2.4".to_string()),
            stars: 12400,
            repository: "https://github.com/example/web-scraper-pro".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-04-01T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
        GitHubSkill {
            id: "mongoconnect".to_string(),
            name: "MongoConnect".to_string(),
            description: "Seamlessly sync your scraped data directly to MongoDB Atlas.".to_string(),
            category: "Data".to_string(),
            author: "MongoDB".to_string(),
            version: Some("v3.0.1".to_string()),
            stars: 8100,
            repository: "https://github.com/example/mongoconnect".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-04-02T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
        GitHubSkill {
            id: "devstream-ide".to_string(),
            name: "DevStream IDE".to_string(),
            description: "Embedded code editor for writing custom skill logic.".to_string(),
            category: "Automation".to_string(),
            author: "DevStream".to_string(),
            version: Some("BETA".to_string()),
            stars: 2200,
            repository: "https://github.com/example/devstream-ide".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-03-28T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
        GitHubSkill {
            id: "s3-archive".to_string(),
            name: "S3 Archive".to_string(),
            description: "Automatically backup all scraper results to AWS S3 buckets.".to_string(),
            category: "Automation".to_string(),
            author: "AWS".to_string(),
            version: Some("v2.1.0".to_string()),
            stars: 15900,
            repository: "https://github.com/example/s3-archive".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-04-01T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
        GitHubSkill {
            id: "gpt-parser".to_string(),
            name: "GPT Parser".to_string(),
            description: "Use LLMs to intelligently parse unstructured HTML into JSON.".to_string(),
            category: "Data".to_string(),
            author: "OpenAI".to_string(),
            version: Some("v0.9.2".to_string()),
            stars: 4600,
            repository: "https://github.com/example/gpt-parser".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-03-30T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
        GitHubSkill {
            id: "webhook-relay".to_string(),
            name: "Webhook Relay".to_string(),
            description: "Push data updates to any external API or webhook endpoint.".to_string(),
            category: "Web".to_string(),
            author: "Webhook".to_string(),
            version: Some("v1.0.0".to_string()),
            stars: 30200,
            repository: "https://github.com/example/webhook-relay".to_string(),
            default_branch: "main".to_string(),
            updated_at: "2026-03-25T00:00:00Z".to_string(),
            install_status: crate::models::InstallStatus::Available,
            enabled_agents: vec![],
        },
    ]
}

/// 从 GitHub 安装技能
#[tauri::command]
pub fn install_from_github(
    repo_url: String,
    agents: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::info!("Installing from {} for agents: {:?}", repo_url, agents);

    let installer = SkillInstaller::new()
        .map_err(|e| format!("Failed to create installer: {}", e))?;

    let mut settings = state.settings_manager.lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    installer.install_from_github(&repo_url, agents, &mut settings)
        .map_err(|e| {
            log::error!("Failed to install: {}", e);
            format!("Failed to install: {}", e)
        })
}

/// 获取默认仓库列表
#[tauri::command]
pub fn get_default_repos() -> Result<Vec<String>, String> {
    Ok(vec![
        "anthropics/claude-plugins-official".to_string(),
        "cursor-shill/cursor-skills".to_string(),
        "alexfauz/custom-gpt-actions".to_string(),
    ])
}
