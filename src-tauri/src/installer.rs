use crate::linker::LinkManager;
use crate::settings::AppSettingsManager;
use anyhow::{Context, Result};
use git2::Repository;
use log::info;
use std::path::PathBuf;

/// 技能安装器
pub struct SkillInstaller {
    skills_dir: PathBuf,
}

impl SkillInstaller {
    /// 创建新的安装器
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir()
            .context("Failed to get home directory")?;
        let skills_dir = home.join(".skills-manager").join("skills");

        // 确保目录存在
        std::fs::create_dir_all(&skills_dir)?;

        Ok(Self { skills_dir })
    }

    /// 从 GitHub 安装技能
    pub fn install_from_github(
        &self,
        repo_url: &str,
        agents: Vec<String>,
        settings_manager: &mut AppSettingsManager,
    ) -> Result<()> {
        info!("Installing skill from: {}", repo_url);

        // 1. 克隆仓库
        let skill_path = self.clone_repo(repo_url)?;

        // 2. 扫描技能
        let skill_metadata = crate::scanner::parse_skill_md(
            &skill_path.join("SKILL.md"),
            crate::models::SkillSource::Global
        )?;

        // 3. 创建 linker
        let config = settings_manager.get_config();
        let linking_strategy = config.linking_strategy;
        let linker = LinkManager::new(linking_strategy);

        // 收集需要的 agent 配置
        let agent_configs: Vec<_> = agents.iter()
            .map(|agent_name| {
                config.agents
                    .iter()
                    .find(|a| &a.name == agent_name)
                    .ok_or_else(|| anyhow::anyhow!("Agent '{}' not found", agent_name))
                    .map(|a| (agent_name.clone(), a.clone()))
            })
            .collect::<Result<Vec<_>>>()?;

        // 4. 为每个 agent 创建链接
        for (agent_name, agent_config) in agent_configs {
            // 创建符号链接
            linker.link_skill_to_agent(&skill_metadata, &agent_config, &self.skills_dir)?;

            // 更新配置
            settings_manager.get_config_mut()
                .skill_states
                .entry(skill_metadata.id.clone())
                .or_insert_with(std::collections::HashMap::new)
                .insert(agent_name.clone(), true);

            info!("Linked {} to agent {}", skill_metadata.id, agent_name);
        }

        // 5. 保存配置
        settings_manager.save()?;

        info!("Skill {} installed successfully", skill_metadata.id);
        Ok(())
    }

    /// 克隆仓库到本地
    fn clone_repo(&self, repo_url: &str) -> Result<PathBuf> {
        // 解析仓库名称
        let repo_name = repo_url
            .split('/')
            .last()
            .unwrap_or("skill")
            .replace(".git", "");

        let clone_path = self.skills_dir.join(&repo_name);

        // 如果已存在，先删除
        if clone_path.exists() {
            std::fs::remove_dir_all(&clone_path)?;
        }

        // 克隆仓库
        Repository::clone(repo_url, &clone_path)
            .with_context(|| format!("Failed to clone {}", repo_url))?;

        info!("Cloned {} to {:?}", repo_url, clone_path);
        Ok(clone_path)
    }
}
