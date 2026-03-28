# Marketplace 功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建技能市场功能，允许用户浏览、发现和安装来自 GitHub 仓库的技能

**Architecture:** 使用现有的 scanner 和 linker 基础设施，添加 GitHub API 集成和安装流程。前端复用 Dashboard 组件保持 UI 一致性。

**Tech Stack:** Rust (Tauri 2), git2-rs, reqwest, React, TypeScript

---

## File Structure

```
src-tauri/src/
├── github_scanner.rs          # 新增：GitHub 仓库扫描
├── installer.rs               # 新增：技能安装器
├── models.rs                  # 修改：添加 GitHubSkill
├── commands/
│   └── github.rs              # 新增：GitHub 相关命令
└── main.rs                    # 修改：注册新命令

app/src/
├── pages/
│   └── Marketplace.tsx         # 修改：连接真实 API
├── components/
│   ├── MarketHeader.tsx        # 新增：搜索和过滤头
│   ├── SkillGrid.tsx           # 新增：技能网格布局
│   ├── GitHubSkillCard.tsx     # 新增：GitHub 技能卡片
│   ├── InstallDialog.tsx       # 新增：安装对话框
│   └── AgentCheckboxList.tsx   # 新增：Agent 选择列表
├── types/
│   └── index.ts                # 修改：添加 GitHubSkill 类型
└── api/
    └── tauri.ts                # 修改：添加 GitHub API
```

---

## Task 1: 添加 GitHubSkill 数据模型

**Files:**
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: 在 models.rs 中添加 GitHubSkill 结构**

在 `src-tauri/src/models.rs` 文件末尾（SkillFileEntry 定义之后）添加：

```rust
/// GitHub 技能信息（用于 Marketplace）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSkill {
    /// 技能 ID (格式: "owner/repo")
    pub id: String,
    /// 技能名称
    pub name: String,
    /// 技能描述
    pub description: String,
    /// 分类
    pub category: String,
    /// 作者
    pub author: String,
    /// 版本（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Stars 数量
    pub stars: i64,
    /// 仓库 URL
    pub repository: String,
    /// 默认分支
    pub default_branch: String,
    /// 最后更新时间
    pub updated_at: String,
    /// 安装状态
    pub install_status: InstallStatus,
    /// 已启用的 Agent 列表
    #[serde(default)]
    pub enabled_agents: Vec<String>,
}

/// 安装状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InstallStatus {
    /// 已安装并启用
    Installed,
    /// 已下载但未启用
    Downloaded,
    /// 未安装
    Available,
}
```

- [ ] **Step 2: 运行编译验证**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: PASS (编译成功)

- [ ] **Step 3: 提交**

```bash
git add src-tauri/src/models.rs
git commit -m "feat(marketplace): add GitHubSkill data model"
```

---

## Task 2: 创建 GitHub Scanner 模块

**Files:**
- Create: `src-tauri/src/github_scanner.rs`

- [ ] **Step 1: 创建 github_scanner.rs 文件**

创建文件 `src-tauri/src/github_scanner.rs`:

```rust
use crate::models::{GitHubSkill, InstallStatus};
use crate::scanner::parse_skill_md;
use anyhow::{Context, Result};
use git2::Repository;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use tempfile::TempDir;

/// GitHub 仓库信息（来自 API）
#[derive(Debug, Deserialize)]
struct GitHubRepoInfo {
    html_url: String,
    default_branch: String,
    stargazers_count: i64,
    updated_at: String,
}

/// GitHub Scanner
pub struct GitHubScanner {
    client: Client,
    token: Option<String>,
}

impl GitHubScanner {
    /// 创建新的 scanner
    pub fn new(token: Option<String>) -> Self {
        Self {
            client: Client::new(),
            token,
        }
    }

    /// 扫描仓库列表
    pub fn scan_repos(&self, repos: Vec<String>) -> Result<Vec<GitHubSkill>> {
        let mut skills = Vec::new();

        for repo_path in repos {
            match self.scan_single_repo(&repo_path) {
                Ok(skill) => {
                    log::info!("Successfully scanned: {}", skill.id);
                    skills.push(skill);
                }
                Err(e) => {
                    log::warn!("Failed to scan {}: {}", repo_path, e);
                    // 继续扫描其他仓库
                }
            }
        }

        Ok(skills)
    }

    /// 扫描单个仓库
    fn scan_single_repo(&self, repo_path: &str) -> Result<GitHubSkill> {
        // 1. 解析仓库路径 "owner/repo"
        let parts: Vec<&str> = repo_path.split('/').collect();
        if parts.len() != 2 {
            return Err(format!("Invalid repo path: {}", repo_path).into());
        }

        let owner = parts[0];
        let repo_name = parts[1];

        // 2. 获取 GitHub API 信息
        let repo_info = self.fetch_repo_info(owner, repo_name)?;

        // 3. 克隆到临时目录
        let temp_dir = TempDir::new()?;
        let clone_path = temp_dir.path().join(repo_name);

        let clone_url = if let Some(token) = &self.token {
            format!("https://{}@github.com/{}/{}.git", token, owner, repo_name)
        } else {
            format!("https://github.com/{}/{}.git", owner, repo_name)
        };

        Repository::clone(&clone_url, &clone_path)
            .with_context(|| format!("Failed to clone {}", repo_path))?;

        // 4. 读取 SKILL.md
        let skill_md = clone_path.join("SKILL.md");
        if !skill_md.exists() {
            return Err("SKILL.md not found".into());
        }

        // 5. 解析 SKILL.md
        let skill_metadata = parse_skill_md(&skill_md, crate::models::SkillSource::Central)?;

        // 6. 构建 GitHubSkill
        Ok(GitHubSkill {
            id: repo_path.to_string(),
            name: skill_metadata.name,
            description: skill_metadata.description,
            category: skill_metadata.category,
            author: skill_metadata.author.unwrap_or_else(|| owner.to_string()),
            version: skill_metadata.version,
            stars: repo_info.stargazers_count,
            repository: repo_info.html_url,
            default_branch: repo_info.default_branch,
            updated_at: repo_info.updated_at,
            install_status: InstallStatus::Available,
            enabled_agents: Vec::new(),
        })
    }

    /// 从 GitHub API 获取仓库信息
    fn fetch_repo_info(&self, owner: &str, repo: &str) -> Result<GitHubRepoInfo> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);

        let mut request = self.client.get(&url);

        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("token {}", token));
        }

        let response = request.send()
            .context("Failed to fetch from GitHub API")?;

        if !response.status().is_success() {
            return Err(format!("GitHub API returned {}", response.status()).into());
        }

        let repo_info: GitHubRepoInfo = response.json()
            .context("Failed to parse GitHub API response")?;

        Ok(repo_info)
    }
}
```

- [ ] **Step 2: 在 Cargo.toml 中添加依赖**

修改 `src-tauri/Cargo.toml`，在 `[dependencies]` 部分添加：

```toml
tempfile = "3"
```

- [ ] **Step 3: 运行编译验证**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: 在 main.rs 中声明模块**

修改 `src-tauri/src/main.rs`，在文件开头添加：

```rust
mod github_scanner;
```

- [ ] **Step 5: 运行编译验证**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/github_scanner.rs src-tauri/src/main.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(marketplace): add GitHub scanner module"
```

---

## Task 3: 创建 Installer 模块

**Files:**
- Create: `src-tauri/src/installer.rs`

- [ ] **Step 1: 创建 installer.rs 文件**

创建文件 `src-tauri/src/installer.rs`:

```rust
use crate::linker::LinkManager;
use crate::models::{AgentConfig, AppConfig, LinkStrategy};
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
            crate::models::SkillSource::Central
        )?;

        // 3. 创建 linker
        let config = settings_manager.get_config();
        let linker = LinkManager::new(config.linking_strategy);

        // 4. 为每个 agent 创建链接
        for agent_name in &agents {
            let agent_config = config.agents
                .iter()
                .find(|a| &a.name == agent_name)
                .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;

            // 创建符号链接
            linker.link_skill_to_agent(&skill_metadata, agent_config, &self.skills_dir)?;

            // 更新配置
            settings_manager.get_config_mut()
                .skill_states
                .entry(skill_metadata.id.clone())
                .or_insert_with(HashMap::new)
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
```

- [ ] **Step 2: 在 main.rs 中声明模块**

修改 `src-tauri/src/main.rs`，在文件开头添加：

```rust
mod installer;
```

- [ ] **Step 3: 运行编译验证**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src-tauri/src/installer.rs src-tauri/src/main.rs
git commit -m "feat(marketplace): add skill installer module"
```

---

## Task 4: 添加 Tauri 命令

**Files:**
- Create: `src-tauri/src/commands/github.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 创建 commands/github.rs 文件**

创建文件 `src-tauri/src/commands/github.rs`:

```rust
use crate::github_scanner::GitHubScanner;
use crate::installer::SkillInstaller;
use crate::models::GitHubSkill;
use crate::settings::AppSettingsManager;
use std::sync::Mutex;
use tauri::State;

/// 应用状态
pub struct AppState {
    pub settings_manager: Mutex<AppSettingsManager>,
}

/// 扫描 GitHub 仓库列表
#[tauri::command]
pub async fn scan_github_repos(
    repos: Vec<String>,
    token: Option<String>,
    _state: State<'_, AppState>,
) -> Result<Vec<GitHubSkill>, String> {
    log::info!("Scanning {} GitHub repositories", repos.len());

    let scanner = GitHubScanner::new(token);
    scanner.scan_repos(repos)
        .map_err(|e| {
            log::error!("Failed to scan GitHub repos: {}", e);
            format!("Failed to scan: {}", e)
        })
}

/// 从 GitHub 安装技能
#[tauri::command]
pub async fn install_from_github(
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
pub async fn get_default_repos() -> Result<Vec<String>, String> {
    Ok(vec![
        "anthropics/claude-plugins-official".to_string(),
    ])
}
```

- [ ] **Step 2: 在 main.rs 中注册模块和命令**

修改 `src-tauri/src/main.rs`:

1. 在文件开头添加：
```rust
mod commands;
use commands::github;
```

2. 在 `tauri::Builder::default()` 中注册命令，添加：
```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    github::scan_github_repos,
    github::install_from_github,
    github::get_default_repos,
])
```

- [ ] **Step 3: 运行编译验证**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src-tauri/src/commands/github.rs src-tauri/src/main.rs
git commit -m "feat(marketplace): add GitHub commands"
```

---

## Task 5: 添加前端类型定义

**Files:**
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: 添加 GitHubSkill 类型**

在 `app/src/types/index.ts` 文件末尾添加：

```typescript
// GitHub 技能信息（用于 Marketplace）
export interface GitHubSkill {
  id: string;                    // "owner/repo"
  name: string;                  // 技能名称
  description: string;           // 描述
  category: string;              // 分类
  author: string;                // 作者
  version?: string;              // 版本
  stars: number;                 // Stars 数量
  repository: string;            // 仓库 URL
  default_branch: string;        // 默认分支
  updated_at: string;            // 更新时间
  install_status: 'installed' | 'downloaded' | 'available';
  enabled_agents: string[];      // 已启用的 Agent
}

// 安装状态
export type InstallStatus = 'installed' | 'downloaded' | 'available';
```

- [ ] **Step 2: 运行编译验证**

Run: `npm run build`
Expected: PASS (TypeScript 编译成功)

- [ ] **Step 3: 提交**

```bash
git add app/src/types/index.ts
git commit -m "feat(marketplace): add GitHubSkill type definition"
```

---

## Task 6: 添加前端 API

**Files:**
- Modify: `app/src/api/tauri.ts`

- [ ] **Step 1: 添加 GitHub API**

在 `app/src/api/tauri.ts` 文件末尾（在 githubApi 对象之后）添加：

```typescript
export const githubApi = {
  /**
   * 扫描 GitHub 仓库列表
   */
  scanRepos: async (repos: string[], token?: string): Promise<GitHubSkill[]> => {
    return await invoke<GitHubSkill[]>('scan_github_repos', { repos, token });
  },

  /**
   * 从 GitHub 安装技能
   */
  install: async (repoUrl: string, agents: string[]): Promise<void> => {
    await invoke('install_from_github', { repoUrl, agents });
  },

  /**
   * 获取默认仓库列表
   */
  getDefaultRepos: async (): Promise<string[]> => {
    return await invoke<string[]>('get_default_repos');
  },
};
```

- [ ] **Step 2: 添加 GitHubSkill 类型导入**

修改 `app/src/api/tauri.ts` 文件开头的导入语句：

```typescript
import type { SkillMetadata, GitHubConfig, AgentConfig, AppConfig, SkillFileEntry, GitHubSkill } from '../types';
```

- [ ] **Step 3: 运行编译验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add app/src/api/tauri.ts
git commit -m "feat(marketplace): add GitHub API methods"
```

---

## Task 7: 创建 MarketHeader 组件

**Files:**
- Create: `app/src/components/MarketHeader.tsx`

- [ ] **Step 1: 创建 MarketHeader 组件**

创建文件 `app/src/components/MarketHeader.tsx`:

```typescript
import { useTranslation } from 'react-i18next';

interface MarketHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
}

export default function MarketHeader({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories
}: MarketHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          search
        </span>
        <input
          type="text"
          placeholder="搜索技能名称、描述或分类..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* 分类过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-[#b71422] text-white font-bold'
                : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
            }`}
          >
            {category === 'All' ? '全部' : category}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行编译验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add app/src/components/MarketHeader.tsx
git commit -m "feat(marketplace): add MarketHeader component"
```

---

## Task 8: 创建 GitHubSkillCard 组件

**Files:**
- Create: `app/src/components/GitHubSkillCard.tsx`

- [ ] **Step 1: 创建 GitHubSkillCard 组件**

创建文件 `app/src/components/GitHubSkillCard.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import type { GitHubSkill } from '../types';

interface GitHubSkillCardProps {
  skill: GitHubSkill;
  onInfo: () => void;
  onInstall: () => void;
}

export default function GitHubSkillCard({ skill, onInfo, onInstall }: GitHubSkillCardProps) {
  const { t } = useTranslation();

  const getStatusBadge = () => {
    switch (skill.install_status) {
      case 'installed':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md">
            <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
            <span className="text-xs font-medium text-green-700">
              已启用 ({skill.enabled_agents.length})
            </span>
          </div>
        );
      case 'downloaded':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <span className="material-symbols-outlined text-sm text-blue-600">download</span>
            <span className="text-xs font-medium text-blue-700">已下载</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
            <span className="material-symbols-outlined text-sm text-gray-500">download</span>
            <span className="text-xs font-medium text-gray-500">可安装</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          {/* 图标 */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#dc2626] to-[#b91c1c] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-xl text-white">extension</span>
          </div>

          {/* 标题和状态 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate mb-1">
              {skill.name}
            </h3>
            {getStatusBadge()}
          </div>
        </div>

        {/* 描述 */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">
          {skill.description}
        </p>

        {/* 元信息 */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>分类: {skill.category}</span>
          <span>•</span>
          <span>⭐ {skill.stars}</span>
          <span>•</span>
          <span>👤 {skill.author}</span>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onInfo}
            className="flex-1 px-4 py-2 border border-[#e1e3e4] dark:border-dark-border rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors"
          >
            详情
          </button>
          <button
            onClick={onInstall}
            className="flex-1 px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={skill.install_status === 'installed'}
          >
            {skill.install_status === 'installed' ? '已安装' : '安装'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行编译验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add app/src/components/GitHubSkillCard.tsx
git commit -m "feat(marketplace): add GitHubSkillCard component"
```

---

## Task 9: 创建 InstallDialog 组件

**Files:**
- Create: `app/src/components/InstallDialog.tsx`

- [ ] **Step 1: 创建 InstallDialog 组件**

创建文件 `app/src/components/InstallDialog.tsx`:

```typescript
import { useState } from 'react';
import type { GitHubSkill, AgentConfig } from '../types';

interface InstallDialogProps {
  skill: GitHubSkill;
  agents: AgentConfig[];
  onConfirm: (selectedAgents: string[]) => void;
  onClose: () => void;
}

export default function InstallDialog({ skill, agents, onConfirm, onClose }: InstallDialogProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());

  const toggleAgent = (agentName: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentName)) {
      newSelected.delete(agentName);
    } else {
      newSelected.add(agentName);
    }
    setSelectedAgents(newSelected);
  };

  const handleConfirm = () => {
    if (selectedAgents.size === 0) {
      alert('请至少选择一个 Agent');
      return;
    }
    onConfirm(Array.from(selectedAgents));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          安装技能: {skill.name}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          选择要启用此技能的 Agent：
        </p>

        <div className="space-y-2 mb-6">
          {agents.filter(a => a.enabled).map((agent) => (
            <label
              key={agent.name}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedAgents.has(agent.name)}
                onChange={() => toggleAgent(agent.name)}
                className="w-5 h-5 text-[#dc2626] rounded focus:ring-[#dc2626]"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{agent.display_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.detected ? '✓ 已检测' : '未安装'}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#e1e3e4] dark:border-dark-border rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg text-sm font-bold text-white"
          >
            确认安装
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行编译验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add app/src/components/InstallDialog.tsx
git commit -m "feat(marketplace): add InstallDialog component"
```

---

## Task 10: 更新 Marketplace 页面

**Files:**
- Modify: `app/src/pages/Marketplace.tsx`

- [ ] **Step 1: 重写 Marketplace.tsx**

完全替换 `app/src/pages/Marketplace.tsx` 的内容：

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { agentsApi, githubApi } from '../api/tauri';
import type { GitHubSkill, AgentConfig } from '../types';
import PageHeader from '../components/PageHeader';
import MarketHeader from '../components/MarketHeader';
import GitHubSkillCard from '../components/GitHubSkillCard';
import InstallDialog from '../components/InstallDialog';

function Marketplace() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<GitHubSkill[]>([]);
  const [filtered, setFiltered] = useState<GitHubSkill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentConfig[]>([]);

  // 安装对话框状态
  const [selectedSkill, setSelectedSkill] = useState<GitHubSkill | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  // 加载 Agents
  useEffect(() => {
    loadAgents();
  }, []);

  // 加载技能列表
  useEffect(() => {
    loadGitHubSkills();
  }, []);

  const loadAgents = async () => {
    try {
      const agentsData = await agentsApi.list();
      setAgents(agentsData);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadGitHubSkills = async () => {
    try {
      setLoading(true);
      const repos = await githubApi.getDefaultRepos();
      const result = await githubApi.scanRepos(repos);
      setSkills(result);
      setFiltered(result);
    } catch (error) {
      console.error('Failed to load skills:', error);
      showErrorMessage('加载技能列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 过滤逻辑
  useEffect(() => {
    const filtered = skills.filter(skill => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || skill.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
    setFiltered(filtered);
  }, [skills, searchTerm, selectedCategory]);

  const handleInstall = async (skill: GitHubSkill) => {
    setSelectedSkill(skill);
    setShowInstallDialog(true);
  };

  const handleConfirmInstall = async (selectedAgents: string[]) => {
    try {
      await githubApi.install(selectedSkill.repository, selectedAgents);
      await loadGitHubSkills(); // 刷新状态
      setShowInstallDialog(false);
      showSuccessMessage(`成功安装 ${selectedSkill.name}`);
    } catch (error) {
      console.error('Failed to install:', error);
      showErrorMessage('安装失败');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon="storefront"
        title={t('header.marketplace')}
        actions={<div />}
      />

      <div className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary">
        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : (
            <>
              <MarketHeader
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                categories={['All', 'Web', 'Git', 'Testing', 'Data', 'Automation']}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                {filtered.map((skill) => (
                  <GitHubSkillCard
                    key={skill.id}
                    skill={skill}
                    onInfo={() => {/* TODO: 详情弹窗 */}}
                    onInstall={() => handleInstall(skill)}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                  未找到匹配的技能
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showInstallDialog && selectedSkill && (
        <InstallDialog
          skill={selectedSkill}
          agents={agents}
          onConfirm={handleConfirmInstall}
          onClose={() => setShowInstallDialog(false)}
        />
      )}
    </div>
  );
}

// 辅助函数
function showErrorMessage(message: string) {
  // TODO: 实现 Toast 通知
  alert(message);
}

function showSuccessMessage(message: string) {
  // TODO: 实现 Toast 通知
  alert(message);
}

export default Marketplace;
```

- [ ] **Step 2: 运行编译验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add app/src/pages/Marketplace.tsx
git commit -m "feat(marketplace): connect Marketplace to real API"
```

---

## Task 11: 移除 mock 数据

**Files:**
- Modify: `app/src/pages/Marketplace.tsx` (已在 Task 10 完成)
- Delete: `app/src/data/mockSkills.ts` (可选，如果不再使用)

- [ ] **Step 1: 检查是否有其他文件使用 mockSkills**

Run: `grep -r "mockSkills" app/src/`
Expected: 只显示 `app/src/pages/Marketplace.tsx` 中的 import（已被移除）

- [ ] **Step 2: 删除 mock 数据文件（可选）**

Run: `rm app/src/data/mockSkills.ts app/src/types/skills.ts`

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore(marketplace): remove unused mock data"
```

---

## Task 12: 测试 Marketplace 功能

**Files:**
- No file changes

- [ ] **Step 1: 启动应用并测试基础功能**

Run: `npm run tauri:dev`

测试步骤：
1. 打开 Marketplace 页面
2. 验证技能列表加载
3. 测试搜索功能
4. 测试分类过滤
5. 点击"安装"按钮
6. 验证 Agent 选择对话框
7. 选择 Agent 并确认安装

Expected:
- 技能列表正确显示
- 搜索和过滤工作正常
- 安装对话框弹出
- 安装成功后状态更新

- [ ] **Step 2: 检查错误日志**

Run: 查看终端输出，确认没有 Rust 错误

Expected: 没有 `error!` 级别的日志

- [ ] **Step 3: 验证安装结果**

Run: 检查技能是否安装到正确位置

```bash
ls -la ~/.skills-manager/skills/
ls -la ~/.claude/skills/plugins/ | grep claude-plugins-official
```

Expected:
- 技能已下载到 `~/.skills-manager/skills/`
- 符号链接已创建到 Agent 目录

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "test(marketplace): verify Marketplace functionality"
```

---

## Task 13: 添加错误处理和用户反馈

**Files:**
- Modify: `app/src/pages/Marketplace.tsx`

- [ ] **Step 1: 改进错误提示**

修改 `showErrorMessage` 和 `showSuccessMessage` 函数：

```typescript
function showErrorMessage(message: string) {
  alert(`❌ 错误: ${message}`);
}

function showSuccessMessage(message: string) {
  alert(`✅ 成功: ${message}`);
}
```

- [ ] **Step 2: 添加加载状态改进**

修改 loading 逻辑，在加载失败时显示错误：

```typescript
const [error, setError] = useState<string | null>(null);

const loadGitHubSkills = async () => {
  try {
    setLoading(true);
    setError(null);
    const repos = await githubApi.getDefaultRepos();
    const result = await githubApi.scanRepos(repos);
    setSkills(result);
    setFiltered(result);
  } catch (error) {
    console.error('Failed to load skills:', error);
    setError('加载失败，请检查网络连接或稍后重试');
  } finally {
    setLoading(false);
  }
};
```

在渲染部分添加错误显示：

```typescript
{loading ? (
  <div className="flex items-center justify-center py-20">
    <div className="text-gray-500">加载中...</div>
  </div>
) : error ? (
  <div className="text-center py-20">
    <div className="text-red-500 mb-4">{error}</div>
    <button
      onClick={loadGitHubSkills}
      className="px-4 py-2 bg-[#dc2626] text-white rounded-lg"
    >
      重试
    </button>
  </div>
) : (
  // 正常内容
)}
```

- [ ] **Step 3: 提交**

```bash
git add app/src/pages/Marketplace.tsx
git commit -m "feat(marketplace): add error handling and user feedback"
```

---

## 完成检查清单

- [ ] 所有任务已完成
- [ ] 应用可以正常启动
- [ ] Marketplace 页面显示 GitHub 技能
- [ ] 搜索和过滤功能正常
- [ ] 安装对话框可以弹出
- [ ] 技能可以成功安装到选中 Agent
- [ ] 安装后状态正确更新
- [ ] 没有编译警告或错误

---

**计划完成时间**: 预计 2-3 小时

**下一步**: 在完成此计划后，可以增强功能（详情弹窗、高级过滤、分页等）或开始 Phase 4 (GitHub Sync)。
