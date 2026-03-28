use crate::models::GitHubRepoConfig;
use anyhow::{anyhow, Context, Result};
use git2::{Repository, Signature};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct GitHubIntegrator {
    skills_manager_dir: PathBuf,
}

impl GitHubIntegrator {
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .context("Failed to get home directory")?;
        let skills_manager_dir = home.join(".claude").join("skills-manager");

        // Create directory if it doesn't exist
        fs::create_dir_all(&skills_manager_dir)?;

        Ok(Self { skills_manager_dir })
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

    /// 推送本地技能到远程仓库
    pub fn push_to_remote(
        &self,
        config: &GitHubRepoConfig,
        source_skills_dir: &Path,
    ) -> Result<()> {
        let cache_dir = self.skills_manager_dir.join(&config.repo);
        eprintln!("=== [sync] 开始同步 ===");
        eprintln!("[sync] cache_dir: {:?}", cache_dir);
        eprintln!("[sync] source_skills_dir: {:?}", source_skills_dir);

        // 1. 克隆或打开缓存仓库
        let repo = if cache_dir.exists() && cache_dir.join(".git").exists() {
            eprintln!("[sync] 打开已有缓存仓库");
            let repo = Repository::open(&cache_dir)?;
            // fetch 最新
            self.fetch_and_reset(&repo, config)?;
            repo
        } else {
            eprintln!("[sync] 克隆仓库");
            let url = build_auth_url(&config.owner, &config.repo, config.token.as_deref());
            Repository::clone(&url, &cache_dir)
                .with_context(|| format!("克隆仓库失败: {}", url))?
        };

        // 2. Checkout 目标分支
        eprintln!("[sync] checkout 分支: {}", config.branch);
        checkout_branch(&repo, &config.branch)?;

        // 3. 复制本地技能到仓库目标路径
        let target_path = cache_dir.join(&config.path);
        eprintln!("[sync] 目标路径: {:?}", target_path);
        fs::create_dir_all(&target_path)?;

        sync_directory_contents(source_skills_dir, &target_path)?;

        // 4. 暂存所有变更
        let mut index = repo.index()?;
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;

        // 5. 检查是否有变更（对比 HEAD 与新 index）
        let head_tree = repo.head()?.peel_to_commit()?.tree()?;
        let diff = repo.diff_tree_to_index(Some(&head_tree), Some(&index), None)?;
        eprintln!("[sync] 检测到 {} 个变更", diff.deltas().len());
        if diff.deltas().len() == 0 {
            eprintln!("[sync] 没有需要同步的变更");
            return Ok(());
        }

        // 6. 提交
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

        // 7. 推送
        eprintln!("[sync] 开始推送到远端...");
        push_to_origin(&repo, &config.branch, config.token.as_deref())?;

        eprintln!("✅ [sync] 技能同步成功推送到 GitHub");
        Ok(())
    }

    /// 从远程仓库恢复技能到本地
    pub fn pull_from_remote(
        &self,
        config: &GitHubRepoConfig,
        target_skills_dir: &Path,
    ) -> Result<u32> {
        let cache_dir = self.skills_manager_dir.join(&config.repo);
        eprintln!("=== [restore] 开始从 GitHub 恢复 ===");
        eprintln!("[restore] cache_dir: {:?}", cache_dir);
        eprintln!("[restore] target_skills_dir: {:?}", target_skills_dir);

        // 1. 克隆或打开缓存仓库并拉取最新
        let repo = if cache_dir.exists() && cache_dir.join(".git").exists() {
            eprintln!("[restore] 打开已有缓存仓库并拉取最新");
            let repo = Repository::open(&cache_dir)?;
            self.fetch_and_reset(&repo, config)?;
            repo
        } else {
            eprintln!("[restore] 克隆仓库");
            let url = build_auth_url(&config.owner, &config.repo, config.token.as_deref());
            Repository::clone(&url, &cache_dir)
                .with_context(|| format!("克隆仓库失败: {}", url))?
        };

        // 2. Checkout 目标分支
        eprintln!("[restore] checkout 分支: {}", config.branch);
        checkout_branch(&repo, &config.branch)?;

        // 3. 确定远端技能源路径
        let source_path = cache_dir.join(&config.path);
        if !source_path.exists() {
            anyhow::bail!("远端仓库中不存在路径 '{}'，没有可恢复的技能", config.path);
        }

        // 4. 遍历远端技能文件夹，逐个恢复到本地
        fs::create_dir_all(target_skills_dir)?;
        let mut restored_count: u32 = 0;

        for entry in fs::read_dir(&source_path)? {
            let entry = entry?;
            let entry_path = entry.path();

            if !entry_path.is_dir() {
                continue;
            }

            let folder_name = match entry_path.file_name().and_then(|n| n.to_str()) {
                Some(name) => name.to_string(),
                None => continue,
            };

            if folder_name.starts_with('.') {
                continue;
            }

            let skill_md = entry_path.join("SKILL.md");
            if !skill_md.exists() {
                eprintln!("[restore] 跳过 '{}': 没有 SKILL.md", folder_name);
                continue;
            }

            let target_folder = target_skills_dir.join(&folder_name);
            if target_folder.exists() {
                eprintln!("[restore] 覆盖已有技能: {}", folder_name);
                fs::remove_dir_all(&target_folder)?;
            }

            copy_dir_recursive(&entry_path, &target_folder)?;
            restored_count += 1;
            eprintln!("[restore] ✅ 已恢复: {}", folder_name);
        }

        eprintln!("✅ [restore] 恢复完成，共恢复 {} 个技能", restored_count);
        Ok(restored_count)
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

    pub fn add_repository(&self, config: &GitHubRepoConfig, repo_name: &str) -> Result<()> {
        let repo_path = self.skills_manager_dir.join(repo_name);

        let url = build_auth_url(&config.owner, &config.repo, config.token.as_deref());

        Repository::clone(&url, &repo_path)
            .with_context(|| format!("克隆仓库失败: {}", url))?;

        // Checkout specific branch
        let repo = Repository::open(&repo_path)?;
        checkout_branch(&repo, &config.branch)?;

        Ok(())
    }

    pub fn remove_repository(&self, repo_name: &str) -> Result<()> {
        let repo_path = self.skills_manager_dir.join(repo_name);
        fs::remove_dir_all(&repo_path)
            .with_context(|| format!("删除仓库失败 {}", repo_name))?;
        Ok(())
    }

    pub fn list_repositories(&self) -> Result<Vec<String>> {
        let mut repos = Vec::new();

        if !self.skills_manager_dir.exists() {
            return Ok(repos);
        }

        for entry in fs::read_dir(&self.skills_manager_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if path.join(".git").exists() {
                        repos.push(name.to_string());
                    }
                }
            }
        }

        Ok(repos)
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

/// 递归复制源目录内容到目标目录
fn sync_directory_contents(source: &Path, target: &Path) -> Result<()> {
    if !source.exists() {
        anyhow::bail!("源目录不存在: {:?}", source);
    }

    for entry in WalkDir::new(source).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_dir() {
            let relative = entry.path().strip_prefix(source)?;
            let target_dir = target.join(relative);
            if !target_dir.exists() {
                fs::create_dir_all(&target_dir)?;
            }
        } else if entry.file_type().is_file() {
            let relative = entry.path().strip_prefix(source)?;
            let target_file = target.join(relative);

            // 跳过 .git 目录下的文件
            if relative.starts_with(".git") {
                continue;
            }

            if let Some(parent) = target_file.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }

            fs::copy(entry.path(), &target_file)?;
        }
    }

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

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}
