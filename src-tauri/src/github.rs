use crate::models::GitHubRepoConfig;
use crate::settings::AppSettingsManager;
use anyhow::{anyhow, Context, Result};
use git2::{Repository, Signature};
use std::fs;
use std::path::PathBuf;

pub struct GitHubIntegrator {
    skills_dir: PathBuf,
}

impl GitHubIntegrator {
    pub fn new() -> Result<Self> {
        let skills_dir = AppSettingsManager::get_skills_dir();
        fs::create_dir_all(&skills_dir)?;
        Ok(Self { skills_dir })
    }

    /// 测试 GitHub 连接：验证仓库和 Token 是否有效
    pub fn test_connection(owner: &str, repo: &str, branch: &str, token: &str) -> Result<bool> {
        // 1. 验证仓库是否可访问
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        match ureq::get(&url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .call()
        {
            Ok(resp) if resp.status() == 200 => {}
            Ok(resp) => anyhow::bail!("GitHub API 返回状态码 {}", resp.status()),
            Err(ureq::Error::Status(401, _)) => {
                anyhow::bail!("Token 无效或已过期，请检查 Personal Access Token 是否正确");
            }
            Err(ureq::Error::Status(403, _)) => {
                anyhow::bail!("权限不足，请确保 Token 具有 repo 权限");
            }
            Err(ureq::Error::Status(404, _)) => {
                anyhow::bail!("仓库 '{}/{}' 不存在，请检查仓库所有者和仓库名是否正确", owner, repo);
            }
            Err(ureq::Error::Status(code, _)) => {
                anyhow::bail!("GitHub API 返回错误 (HTTP {})", code);
            }
            Err(ureq::Error::Transport(e)) => {
                anyhow::bail!("网络连接失败: {}，请检查网络设置", e);
            }
        }

        // 2. 检查分支是否存在
        let branch_url = format!(
            "https://api.github.com/repos/{}/{}/branches/{}",
            owner, repo, branch
        );
        match ureq::get(&branch_url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .call()
        {
            Ok(resp) if resp.status() == 200 => {}
            Ok(resp) => anyhow::bail!("检查分支时返回状态码 {}", resp.status()),
            Err(ureq::Error::Status(404, _)) => {
                anyhow::bail!("分支 '{}' 不存在，请检查分支名是否正确", branch);
            }
            Err(ureq::Error::Status(code, _)) => {
                anyhow::bail!("检查分支时返回错误 (HTTP {})", code);
            }
            Err(ureq::Error::Transport(e)) => {
                anyhow::bail!("网络连接失败: {}", e);
            }
        }

        Ok(true)
    }

    /// 推送本地技能到远程仓库（skills 目录本身就是 git repo）
    pub fn push_to_remote(&self, config: &GitHubRepoConfig) -> Result<()> {
        eprintln!("=== [sync] 开始同步 ===");

        let repo = self.open_or_init_repo(config)?;

        // 1. 暂存所有变更（排除 .git）
        let mut index = repo.index()?;
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;

        // 2. 检查是否有变更
        let head_tree = repo.head()?.peel_to_commit()?.tree()?;
        let diff = repo.diff_tree_to_index(Some(&head_tree), Some(&index), None)?;
        eprintln!("[sync] 检测到 {} 个变更", diff.deltas().len());
        if diff.deltas().len() == 0 {
            eprintln!("[sync] 没有需要同步的变更");
            return Ok(());
        }

        // 3. 提交
        let parent = repo.head()?.peel_to_commit()?;
        let sig = Signature::now("Skills Manager", "skills-manager@local")
            .unwrap_or_else(|_| Signature::now("SkillsManager", "skills-manager@local").unwrap());

        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("Sync skills from Skills Manager [{}]", chrono::Utc::now().format("%Y-%m-%d %H:%M")),
            &tree,
            &[&parent],
        )?;
        eprintln!("[sync] 提交成功");

        // 4. 推送
        eprintln!("[sync] 开始推送到远端...");
        push_to_origin(&repo, &config.branch, config.token.as_deref())?;

        eprintln!("✅ [sync] 技能同步成功推送到 GitHub");
        Ok(())
    }

    /// 从远程仓库恢复技能到本地（直接 clone/pull 到 skills 目录）
    pub fn pull_from_remote(&self, config: &GitHubRepoConfig) -> Result<u32> {
        eprintln!("=== [restore] 开始从 GitHub 恢复 ===");

        let _repo = self.open_or_init_repo(config)?;

        // 统计恢复的 skills 数量
        let mut count: u32 = 0;
        for entry in fs::read_dir(&self.skills_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() && path.join("SKILL.md").exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if !name.starts_with('.') {
                        count += 1;
                        eprintln!("[restore] ✅ 已恢复: {}", name);
                    }
                }
            }
        }

        eprintln!("✅ [restore] 恢复完成，共恢复 {} 个技能", count);
        Ok(count)
    }

    /// 打开已有的 git repo 或 clone 到 skills 目录
    fn open_or_init_repo(&self, config: &GitHubRepoConfig) -> Result<Repository> {
        let git_dir = self.skills_dir.join(".git");

        if git_dir.exists() {
            // 已是 git repo → fetch + hard reset
            eprintln!("[git] 打开已有仓库并拉取最新");
            let repo = Repository::open(&self.skills_dir)?;
            self.fetch_and_reset(&repo, config)?;
            checkout_branch(&repo, &config.branch)?;
            Ok(repo)
        } else if self.skills_dir.exists() {
            // 目录存在但不是 git repo → init + add remote + fetch
            eprintln!("[git] 初始化仓库并拉取远端");
            let repo = Repository::init(&self.skills_dir)?;
            let url = build_auth_url(&config.owner, &config.repo, config.token.as_deref());
            repo.remote("origin", &url)?;
            self.fetch_and_reset(&repo, config)?;
            checkout_branch(&repo, &config.branch)?;
            Ok(repo)
        } else {
            // 目录不存在 → clone
            eprintln!("[git] 克隆仓库到 skills 目录");
            let url = build_auth_url(&config.owner, &config.repo, config.token.as_deref());
            let repo = Repository::clone(&url, &self.skills_dir)
                .with_context(|| format!("克隆仓库失败: {}", url))?;
            checkout_branch(&repo, &config.branch)?;
            Ok(repo)
        }
    }

    /// Fetch 并 reset 到远端最新
    fn fetch_and_reset(&self, repo: &Repository, config: &GitHubRepoConfig) -> Result<()> {
        let mut remote = repo.find_remote("origin")?;

        let token_owned = config.token.clone();
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.credentials(move |_, _, _| {
            if let Some(ref t) = token_owned {
                git2::Cred::userpass_plaintext("x-access-token", t)
            } else {
                git2::Cred::default()
            }
        });

        let mut fetch_opts = git2::FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);
        remote.fetch(&[&config.branch], Some(&mut fetch_opts), None)?;

        // 将本地分支重置到远端最新
        let branch_ref = format!("origin/{}", config.branch);
        let obj = repo.revparse_single(&branch_ref)
            .map_err(|e| anyhow!("无法找到远端分支 '{}': {}", config.branch, e))?;
        repo.reset(&obj, git2::ResetType::Hard, None)?;

        Ok(())
    }

    pub fn add_repository(&self, config: &GitHubRepoConfig, _repo_name: &str) -> Result<()> {
        // 直接在 skills 目录操作，等价于 restore
        self.open_or_init_repo(config)?;
        Ok(())
    }

    pub fn remove_repository(&self, _repo_name: &str) -> Result<()> {
        // 删除 .git 目录以解除 GitHub 关联，保留 skills 文件
        let git_dir = self.skills_dir.join(".git");
        if git_dir.exists() {
            fs::remove_dir_all(&git_dir)
                .with_context(|| "删除 .git 目录失败")?;
        }
        Ok(())
    }

    pub fn list_repositories(&self) -> Result<Vec<String>> {
        if self.skills_dir.join(".git").exists() {
            Ok(vec!["default".to_string()])
        } else {
            Ok(vec![])
        }
    }
}

impl Default for GitHubIntegrator {
    fn default() -> Self {
        Self::new().expect("Failed to create GitHubIntegrator")
    }
}

// === 辅助函数 ===

/// 构建带认证的 Git URL
fn build_auth_url(owner: &str, repo: &str, token: Option<&str>) -> String {
    match token {
        Some(t) => format!("https://x-access-token:{}@github.com/{}/{}.git", t, owner, repo),
        None => format!("https://github.com/{}/{}.git", owner, repo),
    }
}

/// Checkout 到指定分支（创建或更新本地分支以跟踪远端）
fn checkout_branch(repo: &Repository, branch: &str) -> Result<()> {
    let branch_ref = format!("origin/{}", branch);
    let obj = repo.revparse_single(&branch_ref)
        .map_err(|e| anyhow!("分支 '{}' 不存在: {}", branch, e))?;
    let commit = obj.peel_to_commit()?;

    // 创建或更新本地分支指向远端最新提交
    repo.reference(&format!("refs/heads/{}", branch), commit.id(), true, "sync update")?;
    repo.set_head(&format!("refs/heads/{}", branch))?;
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

    Ok(())
}

/// 推送到远程仓库
fn push_to_origin(repo: &Repository, branch: &str, token: Option<&str>) -> Result<()> {
    let mut remote = repo.find_remote("origin")?;
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);

    let token_owned = token.map(String::from);
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(move |_, _, _| {
        if let Some(ref t) = token_owned {
            git2::Cred::userpass_plaintext("x-access-token", t)
        } else {
            git2::Cred::default()
        }
    });

    let mut opts = git2::PushOptions::new();
    opts.remote_callbacks(callbacks);
    remote.push(&[&refspec], Some(&mut opts)).map_err(|e| {
        let msg = e.message().to_string();
        eprintln!("[sync] push error: {}", msg);
        if msg.contains("403") || msg.contains("denied") {
            anyhow!("推送失败: 权限不足。请检查 Token 是否有仓库写入权限（需要勾选 repo 权限范围）。前往设置: https://github.com/settings/personal-access-tokens")
        } else if msg.contains("non-fast-forward") || msg.contains("fast-forward") {
            anyhow!("推送失败: 远端有新变更，请重试同步")
        } else {
            anyhow!("推送失败: {}", msg)
        }
    })?;

    Ok(())
}
