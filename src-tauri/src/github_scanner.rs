use crate::models::{GitHubSkill, InstallStatus};
use anyhow::{anyhow, Result};
use serde::Deserialize;

/// GitHub 仓库信息（来自 API）
#[derive(Debug, Deserialize)]
struct GitHubRepoInfo {
    html_url: String,
    default_branch: String,
    stargazers_count: i64,
    updated_at: String,
    description: Option<String>,
}

/// GitHub 目录内容项
#[derive(Debug, Deserialize)]
struct GitHubContentItem {
    name: String,
    #[serde(rename = "type")]
    type_: String,
}

/// GitHub Scanner
pub struct GitHubScanner {
    token: Option<String>,
}

impl GitHubScanner {
    /// 创建新的 scanner
    pub fn new(token: Option<String>) -> Self {
        Self { token }
    }

    /// 扫描仓库列表（简化版：只调用 GitHub API，不克隆）
    pub fn scan_repos(&self, repos: Vec<String>) -> Result<Vec<GitHubSkill>> {
        let mut all_skills = Vec::new();

        for repo_path in repos {
            match self.scan_repo_all_skills(&repo_path) {
                Ok(skills) => {
                    log::info!("Successfully scanned {} skills from {}", skills.len(), repo_path);
                    all_skills.extend(skills);
                }
                Err(e) => {
                    log::warn!("Failed to scan {}: {}", repo_path, e);
                    // 继续扫描其他仓库
                }
            }
        }

        Ok(all_skills)
    }

    /// 扫描单个仓库的所有技能
    fn scan_repo_all_skills(&self, repo_path: &str) -> Result<Vec<GitHubSkill>> {
        log::info!("开始扫描仓库: {}", repo_path);

        // 1. 解析仓库路径 "owner/repo"
        let parts: Vec<&str> = repo_path.split('/').collect();
        if parts.len() != 2 {
            return Err(anyhow!("Invalid repo path: {}", repo_path));
        }

        let owner = parts[0];
        let repo_name = parts[1];

        log::info!("获取 GitHub API 信息: {}/{}", owner, repo_name);

        // 2. 获取 GitHub API 信息
        let repo_info = self.fetch_repo_info(owner, repo_name)?;
        log::info!("GitHub API 返回: stars={}, branch={}", repo_info.stargazers_count, repo_info.default_branch);

        // 3. 使用 GitHub API 获取仓库内容
        let contents_url = format!(
            "https://api.github.com/repos/{}/{}/contents/",
            owner, repo_name
        );

        let contents = self.fetch_github_contents(&contents_url)?;

        // 4. 遍历内容，查找所有包含 SKILL.md 的目录
        let mut skills = Vec::new();

        // 检查根目录是否有 SKILL.md
        if self.has_skill_md(&contents_url, "") {
            skills.push(self.create_skill_from_repo(
                repo_path,
                &repo_name,
                &repo_info,
                "main"
            ));
        }

        // 遍历所有子目录
        for item in contents {
            if item.type_ == "dir" {
                let dir_path = &item.name;
                // 检查这个目录是否有 SKILL.md
                if self.has_skill_md(&contents_url, dir_path) {
                    let skill_id = format!("{}/{}", repo_path, dir_path);
                    let display_name = format_name(dir_path);

                    skills.push(GitHubSkill {
                        id: skill_id,
                        name: display_name,
                        description: format!("{} skill from {}", dir_path, repo_path),
                        category: infer_category(dir_path),
                        author: owner.to_string(),
                        version: None,
                        stars: repo_info.stargazers_count,
                        repository: repo_info.html_url.clone(),
                        default_branch: repo_info.default_branch.clone(),
                        updated_at: repo_info.updated_at.clone(),
                        install_status: InstallStatus::Available,
                        enabled_agents: Vec::new(),
                    });
                }
            }
        }

        // 如果没有找到任何子技能，至少返回仓库本身
        if skills.is_empty() {
            skills.push(self.create_skill_from_repo(
                repo_path,
                repo_name,
                &repo_info,
                &repo_info.default_branch
            ));
        }

        Ok(skills)
    }

    /// 创建技能对象
    fn create_skill_from_repo(
        &self,
        repo_path: &str,
        repo_name: &str,
        repo_info: &GitHubRepoInfo,
        default_branch: &str,
    ) -> GitHubSkill {
        let display_name = format_name(repo_name);
        let category = infer_category(repo_name);
        let description = repo_info.description.clone().unwrap_or_else(|| {
            format!("从 {} 导入的 GitHub 技能", repo_path)
        });

        GitHubSkill {
            id: repo_path.to_string(),
            name: display_name,
            description,
            category,
            author: repo_path.split('/').next().unwrap_or("Unknown").to_string(),
            version: None,
            stars: repo_info.stargazers_count,
            repository: repo_info.html_url.clone(),
            default_branch: default_branch.to_string(),
            updated_at: repo_info.updated_at.clone(),
            install_status: InstallStatus::Available,
            enabled_agents: Vec::new(),
        }
    }

    /// 检查指定路径是否有 SKILL.md
    fn has_skill_md(&self, base_url: &str, path: &str) -> bool {
        let url = if path.is_empty() {
            format!("{}SKILL.md", base_url)
        } else {
            format!("{}{}/SKILL.md", base_url, path)
        };

        match ureq::get(&url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", self.token.as_ref().unwrap_or(&String::new())))
            .call()
        {
            Ok(response) => response.status() >= 200 && response.status() < 300,
            Err(_) => false,
        }
    }

    /// 获取 GitHub 目录内容
    fn fetch_github_contents(&self, url: &str) -> Result<Vec<GitHubContentItem>> {
        let response = ureq::get(url)
            .set("User-Agent", "skills-manager")
            .set("Authorization", &format!("token {}", self.token.as_ref().unwrap_or(&String::new())))
            .call()
            .map_err(|e| anyhow!("Failed to fetch GitHub contents: {}", e))?;

        let status = response.status();
        if status < 200 || status >= 300 {
            return Err(anyhow!("GitHub API returned status {}", status));
        }

        let text = response.into_string()
            .map_err(|e| anyhow!("Failed to read response: {}", e))?;

        serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse JSON: {}", e))
    }


    /// 从 GitHub API 获取仓库信息（使用 ureq）
    fn fetch_repo_info(&self, owner: &str, repo: &str) -> Result<GitHubRepoInfo> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);

        // 使用 ureq 作为轻量级 HTTP 客户端
        let response = if let Some(token) = &self.token {
            ureq::get(&url)
                .set("Authorization", &format!("token {}", token))
                .set("User-Agent", "skills-manager")
                .call()
        } else {
            ureq::get(&url)
                .set("User-Agent", "skills-manager")
                .call()
        }
        .map_err(|e| anyhow!("Failed to fetch from GitHub API: {}", e))?;

        let status = response.status();
        if status < 200 || status >= 300 {
            return Err(anyhow!("GitHub API returned status {}", status));
        }

        let text = response.into_string()
            .map_err(|e| anyhow!("Failed to read GitHub API response: {}", e))?;

        let repo_info: GitHubRepoInfo = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse GitHub API response: {}", e))?;

        Ok(repo_info)
    }
}

/// 格式化技能名称
fn format_name(repo_name: &str) -> String {
    // 移除常见前缀和后缀
    let name = repo_name
        .trim_start_matches("skill-")
        .trim_start_matches("claude-")
        .trim_end_matches("-skill")
        .trim_end_matches("-plugin");

    // 转换为标题格式
    name.split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    first.to_uppercase().collect::<String>() + chars.as_str()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// 根据仓库名称推断分类
fn infer_category(repo_name: &str) -> String {
    let name_lower = repo_name.to_lowercase();

    if name_lower.contains("web") || name_lower.contains("http") || name_lower.contains("api") {
        "Web".to_string()
    } else if name_lower.contains("git") || name_lower.contains("repo") {
        "Git".to_string()
    } else if name_lower.contains("test") {
        "Testing".to_string()
    } else if name_lower.contains("data") || name_lower.contains("db") {
        "Data".to_string()
    } else if name_lower.contains("auto") || name_lower.contains("script") {
        "Automation".to_string()
    } else {
        "Other".to_string()
    }
}
