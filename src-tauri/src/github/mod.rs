mod git_remote;
mod marketplace;

use crate::models::GitHubRepoConfig;
use crate::settings::AppSettingsManager;
use anyhow::{anyhow, Context, Result};
use git2::{Repository, Signature};
use git_remote::{build_auth_url, checkout_branch, push_to_origin};
use marketplace::{generate_marketplace_json, generate_readme};
use std::collections::HashSet;
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
        // 分层诊断：GitHub API 在 token 无效时会**先**返回 401，无论资源是否存在。
        // 因此如果直接打 /repos/:owner/:repo，当 token 和 owner/repo 同时填错时，
        // 401 会掩盖掉 owner/repo 的错误。这里先用 /user 单独验证 token，再查仓库，
        // 这样每个失败分支的错误文案才能精准对应出错的字段。

        // 1. 单独验证 Token 本身是否有效
        match ureq::get("https://api.github.com/user")
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .call()
        {
            Ok(resp) if resp.status() == 200 => {}
            Ok(resp) => anyhow::bail!("验证 Token 时 GitHub 返回状态码 {}", resp.status()),
            Err(ureq::Error::Status(401, _)) => {
                anyhow::bail!(
                    "Token 无效或已过期（GitHub 返回 401）。由于 Token 本身不通过，仓库所有者 / 仓库名 / 分支还无法验证，请先到 https://github.com/settings/personal-access-tokens 生成或修正 Personal Access Token，再确认其他字段"
                );
            }
            Err(ureq::Error::Status(403, _)) => {
                anyhow::bail!(
                    "Token 被 GitHub 限制使用（403），可能是触发了 SSO 限制或速率限制，请稍后再试或检查 Token 设置"
                );
            }
            Err(ureq::Error::Status(code, _)) => {
                anyhow::bail!("验证 Token 时 GitHub 返回错误 (HTTP {})", code);
            }
            Err(ureq::Error::Transport(e)) => {
                anyhow::bail!("网络连接失败: {}，请检查网络设置", e);
            }
        }

        // 2. 验证仓库是否可访问，并解析 `permissions` 字段判断是否具备写入权限。
        //    注意：`GET /repos/:owner/:repo` 只要 token 能读就返回 200，这里**必须**继续
        //    检查 `permissions.push`，否则只读 token 也能通过测试，push 时才暴露错误。
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        let resp = match ureq::get(&url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", token))
            .call()
        {
            Ok(resp) if resp.status() == 200 => resp,
            Ok(resp) => anyhow::bail!("GitHub API 返回状态码 {}", resp.status()),
            Err(ureq::Error::Status(401, _)) => {
                // Token 刚在 /user 通过，这里再 401 基本是竞态或 GitHub 异常
                anyhow::bail!(
                    "访问仓库时 Token 被拒绝（401），请稍后重试；若持续出现请重新生成 Token"
                );
            }
            Err(ureq::Error::Status(403, _)) => {
                anyhow::bail!(
                    "当前 Token 无权访问仓库 '{}/{}'（403），Fine-grained Token 请确认已勾选该仓库的 Contents 读取权限",
                    owner, repo
                );
            }
            Err(ureq::Error::Status(404, _)) => {
                anyhow::bail!(
                    "仓库 '{}/{}' 不存在或 Token 未授权该仓库。请检查所有者/仓库名是否拼写正确；Fine-grained Token 还需勾选对应仓库",
                    owner, repo
                );
            }
            Err(ureq::Error::Status(code, _)) => {
                anyhow::bail!("GitHub API 返回错误 (HTTP {})", code);
            }
            Err(ureq::Error::Transport(e)) => {
                anyhow::bail!("网络连接失败: {}，请检查网络设置", e);
            }
        };

        // 解析 `permissions.push`，提前拦截"只读 Token"
        let body_str = resp
            .into_string()
            .with_context(|| "读取 GitHub API 响应失败")?;
        let body: serde_json::Value = serde_json::from_str(&body_str)
            .with_context(|| "解析 GitHub API 响应 JSON 失败")?;
        let can_push = body
            .get("permissions")
            .and_then(|p| p.get("push"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !can_push {
            anyhow::bail!(
                "Token 缺少对仓库 '{}/{}' 的写入权限（测试发现 permissions.push=false）。请到 https://github.com/settings/personal-access-tokens 修改 Token：Fine-grained 需勾选该仓库的 Contents: Read and write；Classic 需勾选 repo 权限范围。",
                owner, repo
            );
        }

        // 3. 检查分支是否存在
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
    ///
    /// `overwrite_remote`:
    /// - false = **软备份（append-only）**：
    ///   * fetch 远端但不 reset；若本地可 fast-forward 则前进 HEAD，歧路时保留本地 HEAD
    ///   * 只将「工作区真实存在」的新增/修改文件写入索引（不对本地已删除的 tracked 文件做处理）
    ///   * 结果：本地改动/新增都会被推到远端；本地删除/重命名不会波及远端（远端保留旧版本）
    /// - true  = **镜像推送**：工作区完整暂存（含已跟踪文件的删除）+ `git push --force`，远端严格等于本地
    pub fn push_to_remote(&self, config: &GitHubRepoConfig, overwrite_remote: bool) -> Result<()> {
        eprintln!(
            "=== [sync] 开始同步 (overwrite_remote={}) ===",
            overwrite_remote
        );

        let repo = if overwrite_remote {
            self.open_for_mirror_push(config)?
        } else {
            self.open_for_soft_backup(config)?
        };

        // 0. 自动生成 README.md 和 .claude-plugin/marketplace.json
        generate_readme(&self.skills_dir, config);
        generate_marketplace_json(&self.skills_dir, config);

        // 0.5 无论用户/仓库有没有 .gitignore 规则命中 `.claude-plugin/`，
        // Skills Manager 托管的这两个文件都必须进索引，否则 marketplace 永远同步不到远端。
        self.force_add_managed_files(&repo)?;

        // 1. 暂存变更
        if overwrite_remote {
            // 镜像模式：先将本地已删除的 tracked 文件从索引中移除，再 add 所有文件
            let mut index = repo.index()?;

            // 收集本地已删除的 tracked 文件
            let mut opts = git2::StatusOptions::new();
            opts.include_untracked(false)
                .include_unmodified(false)
                .recurse_untracked_dirs(false);
            let statuses = repo.statuses(Some(&mut opts))?;

            for entry in statuses.iter() {
                let status = entry.status();
                // 如果文件在索引中存在但工作区已删除，从索引中移除
                if status.contains(git2::Status::WT_DELETED) {
                    if let Some(path) = entry.path() {
                        if let Err(e) = index.remove_path(std::path::Path::new(path)) {
                            eprintln!("[sync] remove_path 失败 {}: {}", path, e);
                        }
                    }
                }
            }

            // 然后添加所有工作区文件（包括 gitignore 命中的文件）
            index.add_all(
                ["*"].iter(),
                git2::IndexAddOption::DEFAULT | git2::IndexAddOption::FORCE,
                None,
            )?;
            index.write()?;
        } else {
            // 软备份：只 add 工作区真实存在的 新增/修改 文件
            self.soft_add_workdir(&repo)?;
        }

        // 2. 相对 HEAD 是否有暂存变更
        let index = repo.index()?;
        let head_tree = repo.head()?.peel_to_commit()?.tree()?;
        let diff = repo.diff_tree_to_index(Some(&head_tree), Some(&index), None)?;
        let delta_count = diff.deltas().len();
        eprintln!("[sync] 检测到 {} 个变更", delta_count);

        if delta_count == 0 && !overwrite_remote {
            // 工作区相对 HEAD 没有新变更，不代表"同步完成"——
            // 还必须确认本地 HEAD 没有领先于 origin/<branch>，否则此前未推送成功
            // 的本地 commit（例如上次 push 401 失败留下的）仍需要继续 push，
            // 而不能静默返回 Ok 让 UI 误报"同步成功"。
            let ahead = self.local_ahead_of_remote(&repo, &config.branch)?;
            if ahead == 0 {
                eprintln!("[sync] 没有需要同步的变更");
                return Ok(());
            }
            eprintln!(
                "[sync] 工作区无新变更，但本地领先远端 {} 个未推送的 commit，继续 push",
                ahead
            );
        }

        // 3. 有变更则提交；镜像模式且无变更时仍可能需 force push（丢弃远端多出的提交）
        if delta_count > 0 {
            let parent = repo.head()?.peel_to_commit()?;
            let sig = Signature::now("Skills Manager", "skills-manager@local")
                .unwrap_or_else(|_| Signature::now("SkillsManager", "skills-manager@local").unwrap());

            let mut index = repo.index()?;
            let tree_id = index.write_tree()?;
            let tree = repo.find_tree(tree_id)?;
            let msg = if overwrite_remote {
                format!(
                    "Force sync (mirror local → remote) [{}]\n\nSynced-by: Skills Manager <https://github.com/cchao123/skills-managers>",
                    chrono::Utc::now().format("%Y-%m-%d %H:%M")
                )
            } else {
                format!(
                    "Sync skills from Skills Manager [{}]\n\nSynced-by: Skills Manager <https://github.com/cchao123/skills-managers>",
                    chrono::Utc::now().format("%Y-%m-%d %H:%M")
                )
            };
            repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[&parent])?;
            eprintln!("[sync] 提交成功");
        }

        // 4. 推送
        eprintln!("[sync] 开始推送到远端...");
        push_to_origin(
            &repo,
            &config.branch,
            config.token.as_deref(),
            overwrite_remote,
        )?;

        eprintln!("✅ [sync] 技能同步成功推送到 GitHub");
        Ok(())
    }

    /// 从远程仓库恢复技能到本地
    ///
    /// `overwrite_local`:
    /// - true  = 完全以远端为准：tracked 文件对齐远端，本地 untracked/ignored 文件也会被删除
    /// - false = merge 模式：远端覆盖同名 skill，本地独有（未在远端的）skill 目录保留
    pub fn pull_from_remote(&self, config: &GitHubRepoConfig, overwrite_local: bool) -> Result<u32> {
        eprintln!(
            "=== [restore] 开始从 GitHub 恢复 (overwrite_local={}) ===",
            overwrite_local
        );

        // merge 模式：先记录本地独有的 skill 目录
        let local_only = if !overwrite_local {
            let local_skills = self.list_local_skills();
            let remote_skills = self.list_remote_skills(config)?;
            local_skills.difference(&remote_skills).cloned().collect::<HashSet<String>>()
        } else {
            HashSet::new()
        };

        // 把本地独有的目录临时移到 temp
        let temp_dir = self.skills_dir.join(".restore-tmp");
        if !local_only.is_empty() {
            fs::create_dir_all(&temp_dir)?;
            for skill_id in &local_only {
                let src = self.skills_dir.join(skill_id);
                if src.exists() {
                    let dst = temp_dir.join(skill_id);
                    fs::rename(&src, &dst)?;
                    eprintln!("[restore] 暂存本地独有: {}", skill_id);
                }
            }
        }

        // git fetch + hard reset（拉取远端最新）
        let repo = self.open_or_init_repo(config)?;

        // 覆盖模式：reset --hard 只处理 tracked，untracked/ignored 还留在磁盘上。
        // 这里额外做一次 "git clean -fdx" 语义的清理，保证"本地完全以远端为准"。
        if overwrite_local {
            self.clean_untracked_and_ignored(&repo)?;
        }

        // 把之前暂存的本地独有目录移回
        if !local_only.is_empty() {
            for skill_id in &local_only {
                let src = temp_dir.join(skill_id);
                if src.exists() {
                    let dst = self.skills_dir.join(skill_id);
                    // 如果远端也有同名目录（极端情况），跳过
                    if !dst.exists() {
                        fs::rename(&src, &dst)?;
                        eprintln!("[restore] 恢复本地独有: {}", skill_id);
                    } else {
                        let _ = fs::remove_dir_all(&src);
                    }
                }
            }
            // 清理 temp 目录
            let _ = fs::remove_dir_all(&temp_dir);
        }

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

    /// 仅 fetch 远端分支（不改动工作区 / HEAD）
    fn fetch_origin(&self, repo: &Repository, config: &GitHubRepoConfig) -> Result<()> {
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
        Ok(())
    }

    /// Fetch 并 reset 到远端最新
    fn fetch_and_reset(&self, repo: &Repository, config: &GitHubRepoConfig) -> Result<()> {
        self.fetch_origin(repo, config)?;

        // 将本地分支重置到远端最新
        let branch_ref = format!("origin/{}", config.branch);
        let obj = repo
            .revparse_single(&branch_ref)
            .map_err(|e| anyhow!("无法找到远端分支 '{}': {}", config.branch, e))?;
        repo.reset(&obj, git2::ResetType::Hard, None)?;

        Ok(())
    }

    /// 打开仓库并仅 fetch（用于「本地覆盖远端」：避免 reset 把远端已删文件写回工作区）
    fn open_for_mirror_push(&self, config: &GitHubRepoConfig) -> Result<Repository> {
        let git_dir = self.skills_dir.join(".git");
        if !git_dir.exists() {
            // 首次关联：仍走 clone/init + 对齐远端，后续同步再使用覆盖模式
            return self.open_or_init_repo(config);
        }
        let repo = Repository::open(&self.skills_dir)?;
        self.fetch_origin(&repo, config)?;
        Ok(repo)
    }

    /// 软备份模式：fetch 远端，若本地落后则 fast-forward，但不 reset，保留本地工作区所有改动
    fn open_for_soft_backup(&self, config: &GitHubRepoConfig) -> Result<Repository> {
        let git_dir = self.skills_dir.join(".git");
        if !git_dir.exists() {
            // 首次关联：本地尚无 commit，直接走 clone/init + reset 对齐远端没有副作用
            return self.open_or_init_repo(config);
        }
        let repo = Repository::open(&self.skills_dir)?;
        self.fetch_origin(&repo, config)?;
        self.fast_forward_if_possible(&repo, config)?;
        Ok(repo)
    }

    /// 若本地分支可 fast-forward 到 `origin/<branch>`，则前进 HEAD 并 safe-checkout 工作区；
    /// 本地领先或同步：no-op；歧路：保留现状，后续 push 会自然 reject 并给出提示。
    fn fast_forward_if_possible(&self, repo: &Repository, config: &GitHubRepoConfig) -> Result<()> {
        let local_oid = match repo.head().ok().and_then(|h| h.target()) {
            Some(oid) => oid,
            None => return Ok(()), // 空仓库，无 HEAD
        };

        let branch_ref = format!("origin/{}", config.branch);
        let remote_oid = match repo.revparse_single(&branch_ref) {
            Ok(obj) => obj.id(),
            Err(_) => return Ok(()), // 远端分支不存在（首次推送场景）
        };

        if local_oid == remote_oid {
            return Ok(());
        }

        let (ahead, behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;

        if behind > 0 && ahead == 0 {
            eprintln!("[sync] 本地落后远端 {} 个提交，尝试 fast-forward", behind);
            let remote_commit = repo.find_commit(remote_oid)?;

            // safe checkout：不覆盖本地未提交改动，冲突时返回错误
            let mut opts = git2::build::CheckoutBuilder::new();
            opts.safe();
            repo.checkout_tree(remote_commit.as_object(), Some(&mut opts))
                .map_err(|e| {
                    anyhow!(
                        "本地工作区与远端最新提交存在冲突，无法自动合并。建议先使用「从 GitHub 恢复」对齐本地，或勾选「以本地版本覆盖远程」强制推送。 (底层: {})",
                        e.message()
                    )
                })?;

            repo.reference(
                &format!("refs/heads/{}", config.branch),
                remote_oid,
                true,
                "skills-manager fast-forward",
            )?;
            repo.set_head(&format!("refs/heads/{}", config.branch))?;
            eprintln!("[sync] fast-forward 完成");
        } else if ahead > 0 && behind > 0 {
            eprintln!(
                "[sync] ⚠️ 本地与远端出现歧路（ahead={}, behind={}），保留本地 HEAD；若 push 被拒，请考虑勾选「以本地版本覆盖远程」",
                ahead, behind
            );
        }
        // ahead > 0 && behind == 0：本地领先，直接 push 即可
        Ok(())
    }

    /// 强制把 Skills Manager 自动生成的托管文件加入索引，**绕过 .gitignore**。
    ///
    /// 背景：软备份的 `soft_add_workdir` 出于"只暂存工作区真实改动"的考量，
    /// 使用 `include_ignored(false)` 枚举 status。若用户的全局 gitignore 或
    /// 备份仓库本身的 `.gitignore` 恰好命中 `.claude-plugin/` / `.claude*`，
    /// 这些生成文件会被静默跳过，导致 marketplace.json 永远同步不到远端。
    ///
    /// 这里使用 `IndexAddOption::FORCE` 显式 add，语义等同于 `git add -f`。
    fn force_add_managed_files(&self, repo: &Repository) -> Result<()> {
        const MANAGED_PATHS: &[&str] = &["README.md", ".claude-plugin/marketplace.json"];

        let workdir = repo
            .workdir()
            .ok_or_else(|| anyhow!("仓库没有工作目录"))?
            .to_path_buf();

        let existing: Vec<&str> = MANAGED_PATHS
            .iter()
            .copied()
            .filter(|p| workdir.join(p).is_file())
            .collect();

        if existing.is_empty() {
            return Ok(());
        }

        let mut index = repo.index()?;
        index.add_all(
            existing.iter(),
            git2::IndexAddOption::DEFAULT | git2::IndexAddOption::FORCE,
            None,
        )?;
        index.write()?;
        eprintln!(
            "[sync] 强制暂存托管文件 (绕过 .gitignore): {:?}",
            existing
        );
        Ok(())
    }

    /// 计算本地 HEAD 相对 `origin/<branch>` 领先的 commit 数。
    ///
    /// 返回 0 表示本地和远端一致或落后；>0 表示本地还有这么多 commit 没推上去。
    /// 远端分支不存在时（首次推送场景）视作领先 1（>0），触发 push 以创建远端分支。
    /// 本地 HEAD 不存在（空仓库）时返回 0。
    ///
    /// 注意：调用方需保证在此之前已 fetch 过远端，否则 `origin/<branch>` 可能陈旧。
    fn local_ahead_of_remote(&self, repo: &Repository, branch: &str) -> Result<usize> {
        let local_oid = match repo.head().ok().and_then(|h| h.target()) {
            Some(oid) => oid,
            None => return Ok(0),
        };

        let remote_ref = format!("origin/{}", branch);
        let remote_oid = match repo.revparse_single(&remote_ref) {
            Ok(obj) => obj.id(),
            // 远端分支不存在 → 当成"本地领先"，需要 push 来创建
            Err(_) => return Ok(1),
        };

        let (ahead, _behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;
        Ok(ahead)
    }

    /// 软备份的 add：只把工作区**真实存在**的新增/修改文件写入索引。
    /// 不处理 `WT_DELETED`（本地删除的 tracked 文件），使远端保留旧版本。
    /// 默认尊重 `.gitignore`（不包含 ignored 文件）。
    fn soft_add_workdir(&self, repo: &Repository) -> Result<()> {
        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(false)
            .include_unmodified(false);

        let statuses = repo.statuses(Some(&mut opts))?;
        let workdir = repo
            .workdir()
            .ok_or_else(|| anyhow!("仓库没有工作目录"))?
            .to_path_buf();

        let mut index = repo.index()?;
        let mut added: usize = 0;
        for entry in statuses.iter() {
            let status = entry.status();

            // 跳过：本地删除的 tracked 文件（WT_DELETED）——这是"软备份"的关键
            if status.contains(git2::Status::WT_DELETED) {
                continue;
            }

            // 只关心工作区的新增/修改/重命名/类型变化
            let is_wt_change = status.contains(git2::Status::WT_NEW)
                || status.contains(git2::Status::WT_MODIFIED)
                || status.contains(git2::Status::WT_RENAMED)
                || status.contains(git2::Status::WT_TYPECHANGE);
            if !is_wt_change {
                continue;
            }

            let Some(rel) = entry.path() else { continue };
            let abs = workdir.join(rel);
            if !abs.is_file() {
                // 目录本身不直接 add，libgit2 会在枚举 untracked 时展开到文件层级
                continue;
            }

            if let Err(e) = index.add_path(std::path::Path::new(rel)) {
                eprintln!("[sync] add_path 失败 {}: {}", rel, e);
                continue;
            }
            added += 1;
        }
        index.write()?;
        eprintln!("[sync] 软备份已暂存 {} 个文件（不含本地删除）", added);
        Ok(())
    }

    /// 等价于 `git clean -fdx`：删除工作区内所有 untracked 和 ignored 的文件/目录。
    /// 保留 `.git/` 目录（libgit2 本身不会把它列入 status）。
    fn clean_untracked_and_ignored(&self, repo: &Repository) -> Result<()> {
        let mut opts = git2::StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(true)
            .recurse_ignored_dirs(true)
            .include_unmodified(false);

        let statuses = repo.statuses(Some(&mut opts))?;
        let workdir = repo
            .workdir()
            .ok_or_else(|| anyhow!("仓库没有工作目录"))?
            .to_path_buf();

        // 先收集再删除，避免迭代过程中结构变化
        let mut to_remove: Vec<PathBuf> = Vec::new();
        for entry in statuses.iter() {
            let status = entry.status();
            if !(status.contains(git2::Status::WT_NEW)
                || status.contains(git2::Status::IGNORED))
            {
                continue;
            }
            let Some(rel) = entry.path() else { continue };
            // 防守：绝不误删 .git 本身
            if rel.starts_with(".git/") || rel == ".git" {
                continue;
            }
            to_remove.push(workdir.join(rel));
        }

        for path in to_remove {
            if !path.exists() {
                continue;
            }
            let result = if path.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };
            match result {
                Ok(_) => eprintln!("[restore] 清理: {}", path.display()),
                Err(e) => eprintln!("[restore] 清理失败 {}: {}", path.display(), e),
            }
        }

        Ok(())
    }

    /// 列出本地 skills 目录下的所有 skill 子目录名
    fn list_local_skills(&self) -> HashSet<String> {
        let mut skills = HashSet::new();
        if let Ok(entries) = fs::read_dir(&self.skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.join("SKILL.md").exists() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if !name.starts_with('.') {
                            skills.insert(name.to_string());
                        }
                    }
                }
            }
        }
        skills
    }

    /// 通过 git ls-tree 列出远端分支上的所有 skill 目录名
    fn list_remote_skills(&self, config: &GitHubRepoConfig) -> Result<HashSet<String>> {
        let git_dir = self.skills_dir.join(".git");
        let mut remote_skills = HashSet::new();

        // 先确保 fetch 了最新远端数据
        if git_dir.exists() {
            let repo = Repository::open(&self.skills_dir)?;
            self.fetch_origin(&repo, config)?;

            let branch_ref = format!("origin/{}", config.branch);
            let obj = repo.revparse_single(&branch_ref)?;
            let commit = obj.peel_to_commit()?;
            let tree = commit.tree()?;

            for entry in tree.iter() {
                if let Some(name) = entry.name() {
                    if !name.starts_with('.') && name != "README.md" {
                        let entry_kind = entry.kind();
                        if entry_kind == Some(git2::ObjectType::Tree) {
                            if let Ok(subtree) = repo.find_tree(entry.id()) {
                                for sub_entry in subtree.iter() {
                                    if sub_entry.name() == Some("SKILL.md") {
                                        remote_skills.insert(name.to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        eprintln!("[restore] 远端技能列表: {:?}", remote_skills);
        Ok(remote_skills)
    }
}

impl Default for GitHubIntegrator {
    fn default() -> Self {
        Self::new().expect("Failed to create GitHubIntegrator")
    }
}
