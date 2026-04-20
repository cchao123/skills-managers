//! 低阶 Git 远程操作：URL 构造、分支 checkout、push。
//! 独立于业务逻辑，供 `GitHubIntegrator` 复用。

use anyhow::{anyhow, Result};
use git2::Repository;

/// 构建带认证的 Git URL。
pub(super) fn build_auth_url(owner: &str, repo: &str, token: Option<&str>) -> String {
    match token {
        Some(t) => format!("https://x-access-token:{}@github.com/{}/{}.git", t, owner, repo),
        None => format!("https://github.com/{}/{}.git", owner, repo),
    }
}

/// Checkout 到指定分支（创建或更新本地分支以跟踪远端）。
pub(super) fn checkout_branch(repo: &Repository, branch: &str) -> Result<()> {
    let branch_ref = format!("origin/{}", branch);
    let obj = repo
        .revparse_single(&branch_ref)
        .map_err(|e| anyhow!("分支 '{}' 不存在: {}", branch, e))?;
    let commit = obj.peel_to_commit()?;

    // 创建或更新本地分支指向远端最新提交
    repo.reference(
        &format!("refs/heads/{}", branch),
        commit.id(),
        true,
        "sync update",
    )?;
    repo.set_head(&format!("refs/heads/{}", branch))?;
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;

    Ok(())
}

/// 推送到远程仓库（`force` 时使用 `+refs/heads/branch` 强制远端与本地一致）。
pub(super) fn push_to_origin(
    repo: &Repository,
    branch: &str,
    token: Option<&str>,
    force: bool,
) -> Result<()> {
    let mut remote = repo.find_remote("origin")?;
    let refspec = if force {
        format!("+refs/heads/{}:refs/heads/{}", branch, branch)
    } else {
        format!("refs/heads/{}:refs/heads/{}", branch, branch)
    };

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
        let lower = msg.to_ascii_lowercase();
        eprintln!("[sync] push error: {}", msg);

        // 注意匹配顺序：401/认证失败 要在 403/权限不足 之前判断。
        // GitHub 在 token 过期/被撤销/格式错误 时返回 401 + "Invalid username or token"；
        // 在 token 有效但缺 Contents: Write 时返回 403 + "denied"。
        let is_auth_failure = lower.contains("401")
            || lower.contains("authentication failed")
            || lower.contains("authentication required")
            || lower.contains("invalid username or token")
            || lower.contains("password authentication is not supported")
            || lower.contains("could not read username")
            || lower.contains("bad credentials")
            || lower.contains("unauthorized")
            // libgit2 在 credentials callback 反复被 401 拒后的兜底错误，
            // 表现为 "too many redirects or authentication replays"
            || lower.contains("authentication replays")
            || lower.contains("too many redirects");

        if is_auth_failure {
            anyhow!(
                "推送失败: Token 无效或已过期。请到 https://github.com/settings/personal-access-tokens 重新生成 Personal Access Token（Fine-grained 需勾选目标仓库的 Contents: Read and write 权限；Classic 需勾选 repo 权限范围），然后回到「GitHub 备份」设置里替换旧 Token 后重试同步。"
            )
        } else if lower.contains("403") || lower.contains("denied") {
            anyhow!("推送失败: 权限不足。请检查 Token 是否有仓库写入权限（Fine-grained 需 Contents: Read and write；Classic 需勾选 repo 权限范围）。前往设置: https://github.com/settings/personal-access-tokens")
        } else if lower.contains("non-fast-forward") || lower.contains("fast-forward") {
            anyhow!("推送失败: 远端有新变更，请重试同步；若希望以本地为准，可在同步按钮旁勾选「以本地版本覆盖远程」后重试")
        } else if force && (lower.contains("protected") || lower.contains("protected branch")) {
            anyhow!("强制推送被拒绝: GitHub 上该分支可能开启了保护，请暂时允许 force push 或改用未保护分支")
        } else {
            anyhow!("推送失败: {}", msg)
        }
    })?;

    Ok(())
}
