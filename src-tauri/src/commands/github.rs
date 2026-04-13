use crate::github::GitHubIntegrator;
use crate::models::{GitHubConfig, GitHubRepoConfig};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct AddRepoRequest {
    pub name: String,
    pub owner: String,
    pub repo: String,
    pub branch: String,
    pub token: Option<String>,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct RemoveRepoRequest {
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct SyncRepoRequest {
    pub name: String,
}

pub struct GitHubConfigManager {
    config_path: PathBuf,
}

impl GitHubConfigManager {
    pub fn new() -> anyhow::Result<Self> {
        let home = dirs::home_dir()
            .context("Failed to get home directory")?;
        let config_dir = home.join(".claude").join("plugins").join("data").join("skills-manager");
        fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("github-config.json");
        Ok(Self { config_path })
    }

    pub fn load_config(&self) -> anyhow::Result<GitHubConfig> {
        if !self.config_path.exists() {
            return Ok(GitHubConfig {
                repositories: HashMap::new(),
            });
        }

        let content = fs::read_to_string(&self.config_path)?;
        let config: GitHubConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    pub fn save_config(&self, config: &GitHubConfig) -> anyhow::Result<()> {
        let json = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, json)?;
        Ok(())
    }

    pub fn add_repo(&self, name: String, config: GitHubRepoConfig) -> anyhow::Result<()> {
        let mut github_config = self.load_config()?;
        github_config.repositories.insert(name.clone(), config);
        self.save_config(&github_config)?;
        Ok(())
    }

    pub fn remove_repo(&self, name: &str) -> anyhow::Result<()> {
        let mut github_config = self.load_config()?;
        github_config.repositories.remove(name);
        self.save_config(&github_config)?;
        Ok(())
    }
}

/// 测试 GitHub 连接
#[tauri::command]
pub async fn test_github_connection(
    owner: String,
    repo: String,
    branch: String,
    token: String,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        crate::github::GitHubIntegrator::test_connection(&owner, &repo, &branch, &token)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

/// 保存 GitHub 配置
#[tauri::command]
pub async fn save_github_config(
    owner: String,
    repo: String,
    branch: String,
    path: String,
    token: Option<String>,
) -> Result<(), String> {
    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;

    let repo_config = GitHubRepoConfig {
        owner,
        repo,
        branch,
        token,
        path,
        enabled: true,
        last_sync: None,
    };

    config_manager.add_repo("default".to_string(), repo_config)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取 GitHub 配置
#[tauri::command]
pub async fn get_github_config() -> Result<GitHubConfig, String> {
    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;
    config_manager.load_config()
        .map_err(|e| e.to_string())
}

/// 添加 GitHub 仓库
#[tauri::command]
pub async fn add_github_repo(
    request: AddRepoRequest,
) -> Result<(), String> {
    let integrator = GitHubIntegrator::new()
        .map_err(|e| e.to_string())?;

    let repo_config = GitHubRepoConfig {
        owner: request.owner.clone(),
        repo: request.repo.clone(),
        branch: request.branch.clone(),
        token: request.token.clone(),
        path: request.path.clone(),
        enabled: true,
        last_sync: None,
    };

    let repo_name = request.name.clone();
    let config_for_save = repo_config.clone();

    // Clone repo in blocking thread
    tokio::task::spawn_blocking(move || {
        integrator.add_repository(&repo_config, &repo_name)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    // Save config
    let mut updated_config = config_for_save;
    updated_config.last_sync = Some(chrono::Utc::now().to_rfc3339());

    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;
    config_manager.add_repo(request.name, updated_config)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 删除 GitHub 仓库
#[tauri::command]
pub async fn remove_github_repo(
    request: RemoveRepoRequest,
) -> Result<(), String> {
    let integrator = GitHubIntegrator::new()
        .map_err(|e| e.to_string())?;

    let repo_name = request.name.clone();
    tokio::task::spawn_blocking(move || {
        integrator.remove_repository(&repo_name)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;
    config_manager.remove_repo(&request.name)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 列出 GitHub 仓库
#[tauri::command]
pub async fn list_github_repos() -> Result<Vec<String>, String> {
    let integrator = GitHubIntegrator::new()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        integrator.list_repositories()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

/// 给 GitHub 仓库加星标
#[tauri::command]
pub async fn star_github_repo(owner: String, repo: String, token: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let url = format!("https://api.github.com/user/starred/{}/{}", owner, repo);

        let resp = ureq::put(&url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .set("Accept", "application/vnd.github.v3+json")
            .send_bytes(&[]);

        match resp {
            Ok(r) if r.status() == 204 => Ok(true),
            Ok(r) => Err(format!("GitHub API 返回状态码 {}", r.status())),
            Err(ureq::Error::Status(401, _)) => {
                Err("Token 无效或已过期".to_string())
            }
            Err(ureq::Error::Status(403, _)) => {
                Err("Token 权限不足，请确保具有 starring 权限".to_string())
            }
            Err(ureq::Error::Status(404, _)) => {
                Err("仓库不存在".to_string())
            }
            Err(ureq::Error::Status(code, _)) => {
                Err(format!("GitHub API 错误 (HTTP {})", code))
            }
            Err(ureq::Error::Transport(e)) => Err(format!("网络错误: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

/// 检查是否已给 GitHub 仓库加星标
#[tauri::command]
pub async fn check_github_star(owner: String, repo: String, token: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let url = format!("https://api.github.com/user/starred/{}/{}", owner, repo);

        let resp = ureq::get(&url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .set("Accept", "application/vnd.github.v3+json")
            .call();

        match resp {
            Ok(r) if r.status() == 204 => Ok(true),
            Ok(_) => Ok(false),
            Err(ureq::Error::Status(404, _)) => Ok(false),
            Err(ureq::Error::Status(_, _)) => Ok(false),
            Err(ureq::Error::Transport(_)) => Ok(false),
        }
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

/// 同步 GitHub 仓库（推送本地技能到远端）
#[tauri::command]
pub async fn sync_github_repo(
    request: SyncRepoRequest,
) -> Result<(), String> {
    // 读取配置
    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;
    let config = config_manager.load_config()
        .map_err(|e| e.to_string())?;

    let repo_config = config.repositories.get(&request.name)
        .ok_or_else(|| format!("仓库 '{}' 不存在于配置中", request.name))?
        .clone();

    let integrator = GitHubIntegrator::new()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        integrator.push_to_remote(&repo_config)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    // 更新同步时间
    let mut config = config_manager.load_config().map_err(|e| e.to_string())?;
    if let Some(rc) = config.repositories.get_mut(&request.name) {
        rc.last_sync = Some(chrono::Utc::now().to_rfc3339());
        config_manager.save_config(&config).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 从 GitHub 恢复技能到本地
#[tauri::command]
pub async fn restore_from_github(
    request: SyncRepoRequest,
) -> Result<u32, String> {
    let config_manager = GitHubConfigManager::new()
        .map_err(|e| e.to_string())?;
    let config = config_manager.load_config()
        .map_err(|e| e.to_string())?;

    let repo_config = config.repositories.get(&request.name)
        .ok_or_else(|| format!("仓库 '{}' 不存在于配置中", request.name))?
        .clone();

    let integrator = GitHubIntegrator::new()
        .map_err(|e| e.to_string())?;

    let count = tokio::task::spawn_blocking(move || {
        integrator.pull_from_remote(&repo_config)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    // 更新同步时间
    let mut config = config_manager.load_config().map_err(|e| e.to_string())?;
    if let Some(rc) = config.repositories.get_mut(&request.name) {
        rc.last_sync = Some(chrono::Utc::now().to_rfc3339());
        config_manager.save_config(&config).map_err(|e| e.to_string())?;
    }

    Ok(count)
}
