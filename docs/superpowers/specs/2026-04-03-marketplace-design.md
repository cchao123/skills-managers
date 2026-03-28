# Marketplace 功能设计文档

**Date:** 2026-04-03
**Status:** Approved
**Type:** Feature Implementation
**Scope:** Phase 3 - Marketplace (技能市场)

---

## Overview

Marketplace 功能允许用户浏览、发现和安装来自 GitHub 仓库的技能。它提供技能列表、搜索过滤、详情查看和一键安装功能。

**Goals:**
- 从 GitHub 仓库读取技能信息
- 展示可安装的技能列表
- 支持按分类过滤和名称搜索
- 提供技能详情查看
- 实现两步安装流程（选择 Agent → 下载安装）

---

## Architecture

### Component Structure

```
app/src/pages/
├── Marketplace.tsx              # 主页面
├── components/
│   ├── MarketHeader.tsx         # 标题 + 搜索 + 过滤
│   ├── SkillGrid.tsx            # 技能卡片网格
│   ├── GitHubSkillCard.tsx      # 单个技能卡片
│   ├── InstallDialog.tsx        # Agent 选择对话框
│   └── SkillDetailModal.tsx     # 详情弹窗（复用 Dashboard UI）

src-tauri/src/
├── github_mod.rs                # GitHub 集成模块（新增）
├── installer.rs                 # 技能安装器（新增）
└── commands/
    └── github.rs                # GitHub 相关命令（新增）
```

---

## Data Models

### GitHubSkill

```typescript
interface GitHubSkill {
  // 从 SKILL.md 解析
  id: string;              // "owner/repo"
  name: string;            // 技能名称
  description: string;     // 描述
  category: string;        // 分类
  author: string;          // 作者
  version?: string;        // 版本

  // 从 GitHub API 获取
  stars: number;           // Stars 数量
  repository: string;      // 仓库 URL
  default_branch: string;  // 默认分支
  updated_at: string;      // 更新时间

  // 本地状态
  installStatus: 'installed' | 'downloaded' | 'available';
  enabledAgents: string[]; // 已启用的 Agent
}
```

---

## User Flow

### 浏览流程

1. 打开 Marketplace 页面
2. 系统扫描默认 GitHub 仓库列表
3. 显示技能卡片网格
4. 用户可以：
   - 按分类过滤
   - 按名称搜索
   - 点击"详情"查看完整信息
   - 点击"安装"开始安装流程

### 安装流程

1. 点击技能卡片上的"安装"按钮
2. 弹出 Agent 选择对话框：
   ```
   ┌─────────────────────────────┐
   │ 选择要启用的 Agent          │
   │                             │
   │ ☐ Claude                    │
   │ ☐ Cursor                    │
   │ ☐ Codex                     │
   │ ☐ OpenClaw                  │
   │                             │
   │ [取消] [确认安装]           │
   └─────────────────────────────┘
   ```
3. 用户选择 Agent → 点击"确认安装"
4. 后端执行：
   - 从 GitHub 克隆仓库到 `~/.skills-manager/skills/{repo-name}/`
   - 为选中的 Agent 创建符号链接
   - 更新 `~/.skills-manager/config.json`
5. 显示安装结果

---

## Backend Implementation

### GitHub Scanner

```rust
// src-tauri/src/github_mod.rs

pub struct GitHubScanner {
    token: Option<String>,
    client: reqwest::blocking::Client,
}

impl GitHubScanner {
    pub fn new(token: Option<String>) -> Self {
        Self {
            token,
            client: reqwest::blocking::Client::new(),
        }
    }

    /// 扫描 GitHub 仓库列表，获取技能信息
    pub fn scan_repos(&self, repos: Vec<String>) -> Result<Vec<GitHubSkill>, String> {
        let mut skills = Vec::new();

        for repo in repos {
            match self.scan_repo(&repo) {
                Ok(skill) => skills.push(skill),
                Err(e) => {
                    eprintln!("Failed to scan {}: {}", repo, e);
                    // 继续扫描其他仓库
                }
            }
        }

        Ok(skills)
    }

    /// 扫描单个仓库
    fn scan_repo(&self, repo_path: &str) -> Result<GitHubSkill, String> {
        // 1. 解析仓库路径 "owner/repo"
        let (owner, repo_name) = self.parse_repo_path(repo_path)?;

        // 2. 从 GitHub API 获取仓库信息
        let repo_info = self.fetch_repo_info(&owner, &repo_name)?;

        // 3. 克隆到临时目录
        let temp_dir = self.clone_to_temp(&owner, &repo_name)?;

        // 4. 读取 SKILL.md
        let skill_md = temp_dir.join("SKILL.md");
        if !skill_md.exists() {
            return Err("SKILL.md not found".to_string());
        }

        // 5. 解析 frontmatter
        let frontmatter = parse_skill_frontmatter(&skill_md)?;

        // 6. 组合信息
        Ok(GitHubSkill {
            id: format!("{}/{}", owner, repo_name),
            name: frontmatter.name,
            description: frontmatter.description,
            category: frontmatter.category,
            author: frontmatter.author.unwrap_or_else(|| owner.clone()),
            version: frontmatter.version,
            stars: repo_info.stargazers_count,
            repository: repo_info.html_url,
            default_branch: repo_info.default_branch,
            updated_at: repo_info.updated_at,
            installStatus: Self::check_install_status(&frontmatter.name),
            enabledAgents: vec![],
        })
    }
}
```

### Installer

```rust
// src-tauri/src/installer.rs

pub struct SkillInstaller {
    skills_dir: PathBuf,
    link_manager: LinkManager,
}

impl SkillInstaller {
    /// 从 GitHub 安装技能
    pub fn install_from_github(
        &self,
        repo_url: &str,
        agents: Vec<String>,
        settings_manager: &AppSettingsManager,
    ) -> Result<(), String> {
        // 1. 克隆到本地
        let skill_path = self.clone_repo(repo_url)?;

        // 2. 扫描技能信息
        let skill = self.scan_skill(&skill_path)?;

        // 3. 为每个选中的 Agent 创建链接
        for agent_name in &agents {
            let agent_config = settings_manager.get_config()
                .agents
                .iter()
                .find(|a| &a.name == agent_name)
                .ok_or_else(|| format!("Agent '{}' not found", agent_name))?;

            self.link_manager.link_skill_to_agent(&skill, agent_config)?;

            // 更新配置
            settings_manager.get_config_mut()
                .skill_states
                .entry(skill.id.clone())
                .or_insert_with(HashMap::new)
                .insert(agent_name.clone(), true);
        }

        // 4. 保存配置
        settings_manager.save()?;

        Ok(())
    }
}
```

---

## Frontend Implementation

### Marketplace Page

```typescript
// app/src/pages/Marketplace.tsx

function Marketplace() {
  const [skills, setSkills] = useState<GitHubSkill[]>([]);
  const [filtered, setFiltered] = useState<GitHubSkill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<GitHubSkill | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  // 加载技能列表
  useEffect(() => {
    loadGitHubSkills();
  }, []);

  const loadGitHubSkills = async () => {
    try {
      setLoading(true);
      // 调用后端扫描 GitHub 仓库
      const result = await invoke<GitHubSkill[]>('scan_github_repos', {
        repos: DEFAULT_REPOS,
        token: githubToken
      });
      setSkills(result);
      setFiltered(result);
    } catch (error) {
      console.error('Failed to load skills:', error);
      showErrorMessage('加载技能列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 过滤逻辑
  useEffect(() => {
    const filtered = skills.filter(skill => {
      const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            skill.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
    setFiltered(filtered);
  }, [skills, searchTerm, selectedCategory]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon="storefront"
        title="技能市场"
        actions={<NotificationButton />}
      />

      <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
        <div className="p-8">
          {/* 搜索和过滤 */}
          <MarketHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={['All', 'Web', 'Git', 'Testing', 'Data', 'Automation']}
          />

          {/* 技能网格 */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <SkillGrid
              skills={filtered}
              onInfo={setSelectedSkill}
              onInstall={(skill) => {
                setSelectedSkill(skill);
                setShowInstallDialog(true);
              }}
            />
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onInstall={() => {
            setShowInstallDialog(true);
          }}
        />
      )}

      {/* 安装对话框 */}
      {showInstallDialog && selectedSkill && (
        <InstallDialog
          skill={selectedSkill}
          agents={agents}
          onConfirm={async (selectedAgents) => {
            await handleInstall(selectedSkill, selectedAgents);
            setShowInstallDialog(false);
            await loadGitHubSkills(); // 刷新状态
          }}
          onClose={() => setShowInstallDialog(false)}
        />
      )}
    </div>
  );
}
```

---

## Error Handling (分层降级)

```
┌─────────────────────────────────┐
│ Layer 1: GitHub Token (可选)     │
│ ├─ 成功 → 完整数据               │
│ └─ 限流 → Layer 2               │
├─────────────────────────────────┤
│ Layer 2: 无 Token 请求（受限）   │
│ ├─ 成功 → 完整数据               │
│ └─ 限流 → Layer 3               │
├─────────────────────────────────┤
│ Layer 3: 硬编码默认仓库           │
│ └─ 返回固定列表 + 提示           │
└─────────────────────────────────┘
```

---

## Default Repositories

```rust
const DEFAULT_REPOS: &[&str] = &[
  "anthropics/claude-plugins-official",  // 官方插件
  // 未来可以添加更多：
  // "cursor-skills/community",
  // "custom-skills/awesome",
];
```

用户可以在 Settings 中添加自定义仓库。

---

## Installation States

技能有三种状态：

1. **已启用 (installed)**
   - 技能已下载
   - 至少一个 Agent 已启用
   - 显示：✅ 已启用 (2 agents)

2. **已下载 (downloaded)**
   - 技能已下载到 ~/.skills-manager/skills/
   - 没有启用任何 Agent
   - 显示：📦 已下载

3. **可安装 (available)**
   - 未下载到本地
   - 显示：📥 安装

---

## Success Criteria

### Functional Requirements
- ✅ 能从 GitHub 仓库列表扫描技能
- ✅ 显示技能卡片网格
- ✅ 支持按分类过滤
- ✅ 支持按名称搜索
- ✅ 显示技能详情弹窗（复用 UI）
- ✅ 两步安装流程（选择 Agent）
- ✅ 混合状态检测
- ✅ 分层错误处理

### Non-Functional Requirements
- ✅ UI 风格与 Dashboard 一致
- ✅ 复用现有组件（FileTree, Markdown）
- ✅ 响应式设计
- ✅ 加载状态提示
- ✅ 错误处理和用户反馈

---

## Implementation Phases

### Phase 3.1: 基础版本 (2-3 小时)
- GitHub 扫描功能
- 技能列表显示
- 搜索和过滤
- 基础安装流程

### Phase 3.2: 增强版本 (1-2 天)
- 技能详情弹窗
- Agent 选择对话框
- 混合状态检测
- 分层错误处理
- GitHub Token 配置

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-03
**Status:** Ready for Implementation Planning
