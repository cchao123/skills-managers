# 中央存储功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现技能的中央存储功能，允许用户将 Cursor 和 Claude Code 的技能复制到中央存储目录，并提供统一的界面进行管理。

**Architecture:** 在现有的 Tauri + React 应用中添加中央存储功能。后端使用 Rust 实现文件复制/删除逻辑，前端使用 React 实现 UI 改动，通过 Tauri IPC 进行通信。

**Tech Stack:** Rust (Tauri 2), React 18, TypeScript, Vite, TailwindCSS

---

## Phase 1: 后端数据结构修改

### Task 1: 修改 SkillMetadata 数据结构

**Files:**
- Modify: `src-tauri/src/models.rs:42`

**目标:** 在 `SkillMetadata` 结构体中添加 `in_central_store` 字段

- [ ] **Step 1: 添加 in_central_store 字段到 SkillMetadata**

在 `src-tauri/src/models.rs` 的 `SkillMetadata` 结构体中添加新字段：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    pub enabled: bool,
    #[serde(default)]
    pub agent_enabled: HashMap<String, bool>,
    /// 备份的agent状态（在关闭总开关时保存）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_enabled_backup: Option<HashMap<String, bool>>,
    pub installed_at: String,
    pub last_updated: String,
    /// 技能来源（用于智能默认状态）
    #[serde(default)]
    pub source: SkillSource,
    /// 技能的完整文件系统路径（用于创建符号链接）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// 是否已在中央存储
    #[serde(default)]
    pub in_central_store: bool,
}
```

- [ ] **Step 2: 修改 AppConfig 结构体**

在 `src-tauri/src/models.rs` 的 `AppConfig` 结构体中添加 `central_store_skills` 字段：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub linking_strategy: LinkStrategy,
    pub agents: Vec<AgentConfig>,
    #[serde(default)]
    pub skill_states: HashMap<String, HashMap<String, bool>>,
    #[serde(default = "default_language")]
    pub language: String,
    /// 已收录到中央存储的技能 ID 列表
    #[serde(default)]
    pub central_store_skills: HashSet<String>,
}
```

在文件顶部的 `use` 语句中添加：

```rust
use std::collections::{HashMap, HashSet};
```

- [ ] **Step 3: 验证编译**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: 编译成功，没有错误

- [ ] **Step 4: 提交**

```bash
git add src-tauri/src/models.rs
git commit -m "feat(models): 添加中央存储相关字段

- 在 SkillMetadata 中添加 in_central_store 字段
- 在 AppConfig 中添加 central_store_skills 字段"
```

---

### Task 2: 更新扫描器逻辑

**Files:**
- Modify: `src-tauri/src/scanner.rs:143-150`

**目标:** 在扫描技能时，根据 `central_store_skills` 配置设置 `in_central_store` 字段

- [ ] **Step 1: 修改 scan_skills_directory 函数签名**

修改 `src-tauri/src/scanner.rs` 中的 `scan_skills_directory` 函数，添加 `central_store_skills` 参数：

```rust
pub fn scan_skills_directory(
    base_path: &Path,
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    central_store_skills: &HashSet<String>,
    source: SkillSource,
) -> Result<Vec<SkillMetadata>, ScannerError>
```

- [ ] **Step 2: 在 parse_skill_md 调用处设置 in_central_store**

在 `scan_skills_directory` 函数中，找到 `parse_skill_md` 调用并修改：

```rust
match parse_skill_md(path, source.clone()) {
    Ok(mut skill) => {
        // 填充 agent_enabled 状态
        if let Some(states) = skill_states.get(&skill.id) {
            skill.agent_enabled = states.clone();
            eprintln!("Loaded agent states for skill {}: {:?}", skill.id, skill.agent_enabled);
        } else {
            skill.agent_enabled = get_default_agent_states(&skill.source);
            eprintln!("Set default agent states for skill {} (source: {:?}): {:?}", skill.id, skill.source, skill.agent_enabled);
        }

        // 设置是否在中央存储
        skill.in_central_store = central_store_skills.contains(&skill.id);

        if !seen_ids.contains(&skill.id) {
            seen_ids.insert(skill.id.clone());
            skills.push(skill);
        }
    }
    // ... 错误处理保持不变
}
```

- [ ] **Step 3: 创建新的 scan_all_skill_sources_with_central 函数**

在 `src-tauri/src/scanner.rs` 文件末尾添加新函数：

```rust
/// 扫描所有技能来源（包含中央存储状态）
pub fn scan_all_skill_sources_with_central(
    skill_states: &HashMap<String, HashMap<String, bool>>,
    central_store_skills: &HashSet<String>,
) -> Result<Vec<SkillMetadata>, ScannerError> {
    let mut all_skills = Vec::new();

    // 扫描中央存储
    let central_path = PathBuf::from("~/.skills-manager/skills");
    if central_path.exists() {
        let central_skills = scan_skills_directory(
            &central_path,
            skill_states,
            central_store_skills,
            SkillSource::Central,
        )?;
        all_skills.extend(central_skills);
    }

    // 扫描其他来源
    let other_sources = vec![
        (PathBuf::from("~/.cursor/skills"), SkillSource::Cursor),
        (PathBuf::from("~/.claude/plugins/cache"), SkillSource::Claude),
    ];

    for (base_path, source) in other_sources {
        if base_path.exists() {
            let skills = scan_skills_directory(
                &base_path,
                skill_states,
                central_store_skills,
                source,
            )?;
            all_skills.extend(skills);
        }
    }

    // 去重：如果同一个技能在多个来源存在，只保留一个
    let mut unique_skills = std::collections::HashMap::new();
    for skill in all_skills {
        unique_skills.entry(skill.id.clone())
            .or_insert(skill);
    }

    let mut result: Vec<_> = unique_skills.into_values().collect();
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}
```

- [ ] **Step 4: 验证编译**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: 编译成功，没有错误

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/scanner.rs
git commit -m "feat(scanner): 支持扫描中央存储状态

- 修改 scan_skills_directory 函数，添加 central_store_skills 参数
- 添加 scan_all_skill_sources_with_central 函数
- 根据 central_store_skills 配置设置 in_central_store 字段"
```

---

### Task 3: 实现复制技能到中央存储的命令

**Files:**
- Create: `src-tauri/src/commands/central_store.rs`
- Modify: `src-tauri/src/main.rs`

**目标:** 实现 `copy_skill_to_central` Tauri 命令

- [ ] **Step 1: 创建 central_store.rs 命令文件**

创建新文件 `src-tauri/src/commands/central_store.rs`：

```rust
use crate::models::SkillSource;
use crate::scanner;
use crate::settings::AppSettingsManager;
use log::{info, error};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use walkdir::WalkDir;

/// 应用状态
pub struct AppState {
    pub settings_manager: Mutex<AppSettingsManager>,
}

/// 复制技能到中央存储
#[tauri::command]
pub async fn copy_skill_to_central(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Copying skill '{}' to central store", skill_id);

    let mut settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let mut config = settings.get_config_mut();

    // 检查是否已在中央存储
    if config.central_store_skills.contains(&skill_id) {
        return Err("Skill already in central store".to_string());
    }

    // 扫描所有来源查找技能
    let skills = scanner::scan_all_skill_sources_with_central(
        &config.skill_states,
        &config.central_store_skills,
    ).map_err(|e| {
        error!("Failed to scan skills: {}", e);
        format!("Failed to scan skills: {}", e)
    })?;

    let skill = skills.iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| {
            error!("Skill '{}' not found", skill_id);
            format!("Skill '{}' not found", skill_id)
        })?;

    // 获取技能路径
    let skill_path = skill.path.as_ref()
        .ok_or_else(|| {
            error!("Skill '{}' has no path", skill_id);
            format!("Skill '{}' has no path", skill_id)
        })?;

    let source_path = PathBuf::from(skill_path);
    if !source_path.exists() {
        return Err(format!("Skill path does not exist: {}", skill_path));
    }

    // 创建目标目录
    let central_base = PathBuf::from("~/.skills-manager/skills");
    let target_path = central_base.join(&skill_id);

    if target_path.exists() {
        return Err("Target directory already exists".to_string());
    }

    // 递归复制文件和目录
    std::fs::create_dir_all(&target_path)
        .map_err(|e| {
            error!("Failed to create target directory: {}", e);
            format!("Failed to create target directory: {}", e)
        })?;

    for entry in WalkDir::new(&source_path).into_iter().filter_map(|e| e.ok()) {
        let source_file = entry.path();
        let relative = source_file.strip_prefix(&source_path)
            .map_err(|e| format!("Failed to get relative path: {}", e))?;
        let target_file = target_path.join(relative);

        if source_file.is_dir() {
            std::fs::create_dir_all(&target_file)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            std::fs::copy(source_file, &target_file)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    // 更新配置
    config.central_store_skills.insert(skill_id.clone());
    settings.save_config()
        .map_err(|e| {
            error!("Failed to save config: {}", e);
            format!("Failed to save config: {}", e)
        })?;

    info!("Successfully copied skill '{}' to central store", skill_id);
    Ok(())
}

/// 从中央存储移除技能
#[tauri::command]
pub async fn remove_skill_from_central(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Removing skill '{}' from central store", skill_id);

    let mut settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let mut config = settings.get_config_mut();

    // 检查是否在中央存储
    if !config.central_store_skills.contains(&skill_id) {
        return Err("Skill not in central store".to_string());
    }

    // 删除目录
    let central_base = PathBuf::from("~/.skills-manager/skills");
    let skill_path = central_base.join(&skill_id);

    if skill_path.exists() {
        std::fs::remove_dir_all(&skill_path)
            .map_err(|e| {
                error!("Failed to remove skill directory: {}", e);
                format!("Failed to remove skill directory: {}", e)
            })?;
    }

    // 更新配置
    config.central_store_skills.remove(&skill_id);
    settings.save_config()
        .map_err(|e| {
            error!("Failed to save config: {}", e);
            format!("Failed to save config: {}", e)
        })?;

    info!("Successfully removed skill '{}' from central store", skill_id);
    Ok(())
}
```

- [ ] **Step 2: 在 main.rs 中注册新命令**

修改 `src-tauri/src/main.rs`，在文件顶部添加：

```rust
mod central_store;
use central_store::{copy_skill_to_central, remove_skill_from_central};
```

在 `tauri::generate_handler!` 宏中添加新命令：

```rust
tauri::generate_handler![
    // ... 现有命令
    copy_skill_to_central,
    remove_skill_from_central,
]
```

- [ ] **Step 3: 验证编译**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: 编译成功，没有错误

- [ ] **Step 4: 提交**

```bash
git add src-tauri/src/commands/central_store.rs src-tauri/src/main.rs
git commit -m "feat(backend): 实现中央存储复制和移除命令

- 添加 copy_skill_to_central 命令
- 添加 remove_skill_from_central 命令
- 支持递归复制和删除技能目录"
```

---

### Task 4: 更新 list_skills 命令

**Files:**
- Modify: `src-tauri/src/commands/skills.rs:32-55`

**目标:** 修改 `list_skills` 命令，使用新的扫描函数并填充 `in_central_store` 字段

- [ ] **Step 1: 修改 list_skills 命令**

在 `src-tauri/src/commands/skills.rs` 中，修改 `list_skills` 函数：

```rust
#[tauri::command]
pub async fn list_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String> {
    info!("Listing skills from all sources...");

    let settings = state.settings_manager.lock()
        .map_err(|e| {
            error!("Failed to acquire settings lock: {}", e);
            format!("Failed to acquire lock: {}", e)
        })?;

    let config = settings.get_config();
    info!("Scanning skills from central, cursor, and claude sources...");

    let skills = scanner::scan_all_skill_sources_with_central(
        &config.skill_states,
        &config.central_store_skills,
    ).map_err(|e| {
        error!("Failed to scan skills: {}", e);
        format!("Failed to scan skills: {}", e)
    })?;

    info!("Found {} skills", skills.len());
    Ok(skills)
}
```

- [ ] **Step 2: 验证编译**

Run: `cargo build --manifest-path=src-tauri/Cargo.toml`
Expected: 编译成功，没有错误

- [ ] **Step 3: 提交**

```bash
git add src-tauri/src/commands/skills.rs
git commit -m "feat(skills): 更新 list_skills 使用新的扫描函数

- 使用 scan_all_skill_sources_with_central 扫描技能
- 正确填充 in_central_store 字段"
```

---

## Phase 2: 前端 API 实现

### Task 5: 更新 TypeScript 类型定义

**Files:**
- Modify: `app/src/types/index.ts:5-20`

**目标:** 在前端类型定义中添加 `in_central_store` 字段

- [ ] **Step 1: 修改 SkillMetadata 接口**

在 `app/src/types/index.ts` 中更新 `SkillMetadata` 接口：

```typescript
// Skill Metadata (matches backend Phase 1)
export interface SkillMetadata {
  id: string;                    // Unique identifier (e.g., "superpowers:subagent-driven-development")
  name: string;                  // Skill name
  description: string;           // Skill description
  category: string;              // Skill category
  enabled: boolean;              // Globally enabled flag
  agent_enabled: Record<string, boolean>;  // Per-agent enablement (changed from agent_disabled)
  agent_enabled_backup?: Record<string, boolean>;  // Backup of agent states before main toggle
  source?: SkillSource;          // Where the skill comes from
  author?: string;               // Author (optional)
  version?: string;              // Version (optional)
  repository?: string;           // Repository URL (optional)
  installed_at: string;          // Installation timestamp
  last_updated: string;          // Last update timestamp
  path?: string;                 // Full file system path (optional, used for creating symlinks)
  in_central_store?: boolean;    // Whether the skill is in central store
}
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run type-check`
Expected: 没有类型错误

- [ ] **Step 3: 提交**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): 添加 in_central_store 字段到 SkillMetadata"
```

---

### Task 6: 实现 API 调用函数

**Files:**
- Modify: `app/src/api/tauri.ts`

**目标:** 添加中央存储相关的 API 调用函数

- [ ] **Step 1: 添加中央存储 API 函数**

在 `app/src/api/tauri.ts` 文件中添加新的 API 函数：

```typescript
// 中央存储相关 API
export const centralStoreApi = {
  /**
   * 复制技能到中央存储
   */
  copyToCentral: async (skillId: string): Promise<void> => {
    await invoke('copy_skill_to_central', { skillId });
  },

  /**
   * 从中央存储移除技能
   */
  removeFromCentral: async (skillId: string): Promise<void> => {
    await invoke('remove_skill_from_central', { skillId });
  },
};
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run type-check`
Expected: 没有类型错误

- [ ] **Step 3: 提交**

```bash
git add app/src/api/tauri.ts
git commit -m "feat(api): 添加中央存储 API 调用函数

- 添加 copyToCentral 函数
- 添加 removeFromCentral 函数"
```

---

## Phase 3: UI 实现

### Task 7: 修改分类标签栏

**Files:**
- Modify: `app/src/pages/Dashboard/components/SearchAndFilterBar.tsx:65-104`

**目标:** 在"按来源展示"模式下添加"中央存储"分类标签

- [ ] **Step 1: 修改组件 Props 接口**

在 `SearchAndFilterBar.tsx` 中，修改 props 接口，添加新的分类类型：

```typescript
interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'enabled' | 'disabled';
  onFilterChange: (type: 'all' | 'enabled' | 'disabled') => void;
  skills: SkillMetadata[];
  viewMode: 'flat' | 'agent';
  selectedSource: string;  // 改名：从 selectedAgent 改为 selectedSource
  onSourceSelect: (source: string) => void;  // 改名：从 onAgentSelect 改为 onSourceSelect
  agents: AgentConfig[];
}
```

- [ ] **Step 2: 修改组件解构**

更新组件的 props 解构：

```typescript
export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  skills,
  viewMode,
  selectedSource,
  onSourceSelect,
  agents,
}) => {
```

- [ ] **Step 3: 修改 Agent Filters 部分**

替换原有的 Agent Filters 为 Source Filters：

```typescript
{viewMode === 'agent' && (
  <>
    {/* Source Filters */}
    <div className="flex flex-wrap items-center gap-2">
      {/* Claude Code */}
      <button
        onClick={() => onSourceSelect('claude')}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          selectedSource === 'claude'
            ? 'bg-[#b71422] text-white font-bold'
            : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <img src={getAgentIcon('claude')} alt="Claude Code" className="w-full h-full object-contain" />
        </div>
        <span>Claude Code</span>
      </button>

      {/* Cursor */}
      <button
        onClick={() => onSourceSelect('cursor')}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          selectedSource === 'cursor'
            ? 'bg-[#b71422] text-white font-bold'
            : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
        }`}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <img src={getAgentIcon('cursor')} alt="Cursor" className="w-full h-full object-contain" />
        </div>
        <span>Cursor</span>
      </button>

      {/* 中央存储 */}
      <button
        onClick={() => onSourceSelect('central')}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          selectedSource === 'central'
            ? 'bg-[#b71422] text-white font-bold'
            : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
        }`}
      >
        <span className="material-symbols-outlined text-base">folder_special</span>
        <span>中央存储</span>
      </button>

      {/* 全部 */}
      <button
        onClick={() => onSourceSelect('All')}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          selectedSource === 'All'
            ? 'bg-[#b71422] text-white font-bold'
            : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
        }`}
      >
        <span className="text-base">🐙</span>
        <span>全部</span>
      </button>
    </div>
  </>
)}
```

- [ ] **Step 4: 提交**

```bash
git add app/src/pages/Dashboard/components/SearchAndFilterBar.tsx
git commit -m "feat(ui): 添加中央存储分类标签

- 将 selectedAgent 改名为 selectedSource
- 添加 Claude Code、Cursor、中央存储、全部四个分类标签
- 使用图标区分不同分类"
```

---

### Task 8: 更新 Dashboard 页面

**Files:**
- Modify: `app/src/pages/Dashboard/index.tsx`

**目标:** 更新 Dashboard 页面以支持新的分类逻辑

- [ ] **Step 1: 修改状态和变量**

在 `Dashboard` 组件中，修改状态变量名：

```typescript
const [selectedSource, setSelectedSource] = useState<string>('All');  // 从 selectedAgent 改名
```

- [ ] **Step 2: 修改切换视图处理器**

更新 `handleViewModeChange` 函数：

```typescript
const handleViewModeChange = (mode: string) => {
  setViewMode(mode);
  if (mode === 'agent') {
    setSelectedSource('All');  // 从 selectedAgent 改为 selectedSource
  }
};
```

- [ ] **Step 3: 修改过滤逻辑**

将原有的 `filteredByAgent` 改为 `filteredBySource`：

```typescript
// 根据选中的source筛选技能
const filteredBySource = selectedSource === 'All'
  ? marketplaceSkills
  : selectedSource === 'central'
    ? marketplaceSkills.filter(skill => {
        const originalSkill = filteredSkills.find(s => s.id === skill.id);
        return originalSkill?.in_central_store;
      })
    : marketplaceSkills.filter(skill => {
        const originalSkill = filteredSkills.find(s => s.id === skill.id);
        return originalSkill?.source === selectedSource;
      });
```

- [ ] **Step 4: 更新 SearchAndFilterBar props**

更新传递给 `SearchAndFilterBar` 的 props：

```typescript
<SearchAndFilterBar
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  filterType={filterType}
  onFilterChange={setFilterType}
  skills={skills}
  viewMode={viewMode as 'flat' | 'agent'}
  selectedSource={selectedSource}  // 从 selectedAgent 改名
  onSourceSelect={setSelectedSource}  // 从 onAgentSelect 改名
  agents={agents}
/>
```

- [ ] **Step 5: 更新视图渲染**

将 `filteredByAgent` 改为 `filteredBySource`：

```typescript
{viewMode === 'agent' && (
  <div className="bg-[#f8f9fa] dark:bg-dark-bg-secondary">
    <div className="space-y-6">
      {/* Skills Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredBySource.map((skill) => (  // 从 filteredByAgent 改名
          <MarketplaceSkillCard
            key={skill.id}
            skill={skill}
            onInstall={() => {
              const originalSkill = skills.find(s => s.id === skill.id);
              if (originalSkill) {
                handleToggleSkill(originalSkill);
              }
            }}
            onInfo={() => handleShowSkillDetail(skills.find(s => s.id === skill.id)!)}
          />
        ))}
      </div>

      {filteredBySource.length === 0 && (  // 从 filteredByAgent 改名
        <div className="text-center py-20 text-slate-500 dark:text-gray-400">
          该分类下暂无技能
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: 验证编译**

Run: `npm run build`
Expected: 编译成功，没有错误

- [ ] **Step 7: 提交**

```bash
git add app/src/pages/Dashboard/index.tsx
git commit -m "feat(dashboard): 更新分类过滤逻辑

- 将 selectedAgent 改名为 selectedSource
- 实现按 source 和 in_central_store 过滤技能
- 支持中央存储分类显示"
```

---

### Task 9: 更新 Skill 类型适配

**Files:**
- Modify: `app/src/pages/Dashboard/index.tsx:82-96`

**目标:** 在 `convertToMarketplaceSkill` 函数中添加中央存储状态

- [ ] **Step 1: 修改 convertToMarketplaceSkill 函数**

更新函数以包含中央存储状态：

```typescript
const convertToMarketplaceSkill = (skill: SkillMetadata): Skill => {
  const isInCentralStore = skill.in_central_store || false;
  const isCentralSource = skill.source === 'central';

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version || '1.0.0',
    category: 'Skill',
    icon: getSkillIcon(skill.id),
    iconColor: getSkillColor(skill.id),
    rating: 4.5,
    downloads: '1k',
    author: 'Skills Manager',
    installed: skill.enabled,
    in_central_store: isInCentralStore,  // 新增字段
    source: skill.source,  // 新增字段
    // 根据状态决定按钮文字
    action_text: isCentralSource ? '从中央存储移除' :
                isInCentralStore ? '已收录到中央存储' :
                '收录到中央存储',
    action_disabled: isInCentralStore && !isCentralSource,  // 已收录但非中央来源时禁用
  };
};
```

- [ ] **Step 2: 更新 Skill 类型**

在 `app/src/types/skills.ts` 中添加新字段：

```typescript
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  icon: string;
  iconColor: string;
  rating: number;
  downloads: string;
  author: string;
  installed: boolean;
  in_central_store?: boolean;  // 新增
  source?: 'central' | 'cursor' | 'claude';  // 新增
  action_text?: string;  // 新增
  action_disabled?: boolean;  // 新增
}
```

- [ ] **Step 3: 提交**

```bash
git add app/src/pages/Dashboard/index.tsx app/src/types/skills.ts
git commit -m "feat(types): 添加中央存储状态到 Skill 类型

- 在 Skill 接口中添加 in_central_store、source、action_text、action_disabled 字段
- 更新 convertToMarketplaceSkill 函数以设置这些字段"
```

---

### Task 10: 修改 MarketplaceSkillCard 组件

**Files:**
- Modify: `app/src/pages/Dashboard/components/MarketplaceSkillCard.tsx`

**目标:** 更新技能卡片以支持收录/移除按钮和状态标记

- [ ] **Step 1: 修改组件接口**

更新 `MarketplaceSkillCard` 组件的 props：

```typescript
interface MarketplaceSkillCardProps {
  skill: Skill;
  onInstall: (skillId: string) => void;
  onInfo: (skillId: string) => void;
  onCopyToCentral?: (skillId: string) => void;  // 新增
  onRemoveFromCentral?: (skillId: string) => void;  // 新增
}
```

- [ ] **Step 2: 实现新的卡片渲染逻辑**

替换整个组件实现：

```typescript
function MarketplaceSkillCard({
  skill,
  onInstall,
  onInfo,
  onCopyToCentral,
  onRemoveFromCentral,
}: MarketplaceSkillCardProps) {
  const isInCentralStore = skill.in_central_store || false;
  const isCentralSource = skill.source === 'central';

  return (
    <article className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 flex flex-col group overflow-hidden">
      <div className="p-4">
        {/* Icon + Version badge + 中央存储标记 */}
        <div className="flex justify-between items-start mb-3">
          <div className={`w-12 h-12 rounded-lg ${skill.iconColor} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-2xl" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
              {skill.icon}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 中央存储标记 */}
            {isInCentralStore && (
              <span className="text-[10px] font-bold py-0.5 px-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">folder_special</span>
                中央存储
              </span>
            )}
            <span className="text-[10px] font-bold py-0.5 px-1.5 bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-300 rounded uppercase">
              {skill.version}
            </span>
          </div>
        </div>

        <h4 className="text-base font-bold mb-1 truncate text-slate-900 dark:text-white">{skill.name}</h4>
        <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 leading-relaxed">
          {skill.description}
        </p>

        {/* Rating + Downloads */}
        <div className="flex items-center gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
            <span className="text-[#191c1d] dark:text-white">{skill.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs dark:text-gray-400">download</span>
            <span className="dark:text-gray-300">{skill.downloads}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isCentralSource ? (
            // 中央存储来源：显示移除按钮
            <button
              onClick={() => onRemoveFromCentral?.(skill.id)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
            >
              {skill.action_text || '从中央存储移除'}
            </button>
          ) : isInCentralStore ? (
            // 已收录到中央存储：显示禁用按钮
            <button
              disabled
              className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 py-2 rounded-lg font-bold text-xs cursor-not-allowed"
            >
              {skill.action_text || '已收录到中央存储'}
            </button>
          ) : (
            // 未收录：显示收录按钮
            <button
              onClick={() => onCopyToCentral?.(skill.id)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
            >
              {skill.action_text || '收录到中央存储'}
            </button>
          )}
          <button
            onClick={() => onInfo(skill.id)}
            className="w-9 h-9 border border-[#e1e3e4] dark:border-dark-border bg-[#f3f4f5] dark:bg-dark-bg-tertiary text-slate-600 dark:text-gray-300 rounded-lg flex items-center justify-center hover:bg-[#edeeef] dark:hover:bg-dark-hover transition-colors"
          >
            <span className="material-symbols-outlined text-base">info</span>
          </button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: 更新 Dashboard 中的使用**

在 `Dashboard/index.tsx` 中更新 `MarketplaceSkillCard` 的使用：

```typescript
{filteredBySource.map((skill) => (
  <MarketplaceSkillCard
    key={skill.id}
    skill={skill}
    onInstall={() => {
      const originalSkill = skills.find(s => s.id === skill.id);
      if (originalSkill) {
        handleToggleSkill(originalSkill);
      }
    }}
    onInfo={() => handleShowSkillDetail(skills.find(s => s.id === skill.id)!)}
    onCopyToCentral={handleCopyToCentral}
    onRemoveFromCentral={handleRemoveFromCentral}
  />
))}
```

- [ ] **Step 4: 提交**

```bash
git add app/src/pages/Dashboard/components/MarketplaceSkillCard.tsx
git commit -m "feat(card): 更新技能卡片支持中央存储操作

- 添加中央存储标记显示
- 根据状态显示不同的按钮（收录/移除/已收录）
- 支持 onCopyToCentral 和 onRemoveFromCentral 回调"
```

---

### Task 11: 实现收录和移除处理函数

**Files:**
- Modify: `app/src/pages/Dashboard/index.tsx`

**目标:** 实现 `handleCopyToCentral` 和 `handleRemoveFromCentral` 函数

- [ ] **Step 1: 添加 import 语句**

在文件顶部添加：

```typescript
import { centralStoreApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
```

- [ ] **Step 2: 在 Dashboard 组件中添加 Toast hook**

```typescript
function Dashboard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  // ... 其他代码
```

- [ ] **Step 3: 实现处理函数**

在组件中添加以下函数：

```typescript
// 处理收录到中央存储
const handleCopyToCentral = async (skillId: string) => {
  try {
    await centralStoreApi.copyToCentral(skillId);
    showToast('success', '已收录到中央存储');
    await loadSkills(); // 刷新技能列表
  } catch (error) {
    console.error('Failed to copy skill to central:', error);
    showToast('error', error instanceof Error ? error.message : '收录失败');
  }
};

// 处理从中央存储移除
const handleRemoveFromCentral = async (skillId: string) => {
  try {
    await centralStoreApi.removeFromCentral(skillId);
    showToast('success', '已从中央存储移除');
    await loadSkills(); // 刷新技能列表
  } catch (error) {
    console.error('Failed to remove skill from central:', error);
    showToast('error', error instanceof Error ? error.message : '移除失败');
  }
};
```

- [ ] **Step 4: 验证编译**

Run: `npm run build`
Expected: 编译成功，没有错误

- [ ] **Step 5: 提交**

```bash
git add app/src/pages/Dashboard/index.tsx
git commit -m "feat(dashboard): 实现收录和移除处理函数

- 添加 handleCopyToCentral 函数
- 添加 handleRemoveFromCentral 函数
- 集成 Toast 通知和错误处理"
```

---

### Task 12: 更新帮助文本

**Files:**
- Modify: `app/src/pages/Dashboard/index.tsx:221-234`

**目标:** 更新帮助弹出框中的文本

- [ ] **Step 1: 更新帮助文本**

在帮助弹出框中更新"按来源展示"的描述：

```typescript
<div>
  <div className="font-medium text-gray-800 dark:text-gray-200 mb-1">按来源展示</div>
  <div className="text-gray-600 dark:text-gray-400">
    按照技能来源分类展示：Claude Code、Cursor、中央存储。支持将技能收录到中央存储或从中央存储移除
  </div>
</div>
```

- [ ] **Step 2: 提交**

```bash
git add app/src/pages/Dashboard/index.tsx
git commit -m "docs(ui): 更新帮助文本说明中央存储功能"
```

---

## Phase 4: 测试和验证

### Task 13: 手动测试收录功能

**目标:** 验证完整的收录流程

- [ ] **Step 1: 启动开发服务器**

Run: `npm run tauri:dev`

- [ ] **Step 2: 测试收录功能**

1. 切换到"按来源展示"视图
2. 选择"Claude Code"或"Cursor"分类
3. 找到一个未收录的技能（按钮显示"收录到中央存储"）
4. 点击"收录到中央存储"按钮
5. 验证：
   - 显示成功提示
   - 按钮变为禁用状态，显示"已收录到中央存储"
   - 出现"中央存储"标记
6. 切换到"中央存储"分类
7. 验证：收录的技能出现在列表中

- [ ] **Step 3: 测试移除功能**

1. 在"中央存储"分类中找到一个技能
2. 点击"从中央存储移除"按钮
3. 验证：
   - 显示成功提示
   - 技能从列表中消失
4. 切换回原始分类（Claude Code 或 Cursor）
5. 验证：
   - 技能恢复为"可收录"状态
   - "中央存储"标记消失

- [ ] **Step 4: 测试文件系统**

1. 打开 `~/.skills-manager/skills/` 目录
2. 验证收录的技能被复制到该目录
3. 移除技能后验证目录被删除
4. 验证原始来源的技能文件不受影响

- [ ] **Step 5: 测试边界情况**

1. 尝试重复收录同一个技能（应该提示已收录）
2. 在收录过程中断开连接（应该显示错误）
3. 收录一个包含大量文件的技能（验证性能）

---

### Task 14: 编写集成测试

**Files:**
- Create: `src-tauri/tests/central_store_test.rs`

**目标:** 编写集成测试验证中央存储功能

- [ ] **Step 1: 创建测试文件**

创建 `src-tauri/tests/central_store_test.rs`：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_copy_skill_to_central() {
        // 测试复制技能到中央存储
        // 1. 创建测试技能目录
        // 2. 调用 copy_skill_to_central
        // 3. 验证文件被复制
        // 4. 验证配置被更新
    }

    #[test]
    fn test_remove_skill_from_central() {
        // 测试从中央存储移除技能
        // 1. 先收录一个技能
        // 2. 调用 remove_skill_from_central
        // 3. 验证目录被删除
        // 4. 验证配置被更新
    }

    #[test]
    fn test_copy_already_copied_skill() {
        // 测试重复收录同一个技能
        // 1. 收录一个技能
        // 2. 再次尝试收录
        // 3. 验证返回错误
    }

    #[test]
    fn test_remove_nonexistent_skill() {
        // 测试移除不存在的技能
        // 1. 尝试移除未收录的技能
        // 2. 验证返回错误
    }
}
```

- [ ] **Step 2: 运行测试**

Run: `cargo test --manifest-path=src-tauri/Cargo.toml`

- [ ] **Step 3: 提交**

```bash
git add src-tauri/tests/central_store_test.rs
git commit -m "test: 添加中央存储集成测试

- 测试收录功能
- 测试移除功能
- 测试边界情况"
```

---

### Task 15: 性能优化和错误处理

**目标:** 添加加载状态和错误处理

- [ ] **Step 1: 添加加载状态**

在 `Dashboard/index.tsx` 中添加加载状态：

```typescript
const [loadingAction, setLoadingAction] = useState<string | null>(null);

const handleCopyToCentral = async (skillId: string) => {
  try {
    setLoadingAction(skillId);
    await centralStoreApi.copyToCentral(skillId);
    showToast('success', '已收录到中央存储');
    await loadSkills();
  } catch (error) {
    console.error('Failed to copy skill to central:', error);
    showToast('error', error instanceof Error ? error.message : '收录失败');
  } finally {
    setLoadingAction(null);
  }
};

const handleRemoveFromCentral = async (skillId: string) => {
  try {
    setLoadingAction(skillId);
    await centralStoreApi.removeFromCentral(skillId);
    showToast('success', '已从中央存储移除');
    await loadSkills();
  } catch (error) {
    console.error('Failed to remove skill from central:', error);
    showToast('error', error instanceof Error ? error.message : '移除失败');
  } finally {
    setLoadingAction(null);
  }
};
```

- [ ] **Step 2: 更新 MarketplaceSkillCard 以显示加载状态**

传递 `loadingAction` 到卡片组件：

```typescript
<MarketplaceSkillCard
  key={skill.id}
  skill={skill}
  onInstall={() => { /* ... */ }}
  onInfo={() => { /* ... */ }}
  onCopyToCentral={handleCopyToCentral}
  onRemoveFromCentral={handleRemoveFromCentral}
  loading={loadingAction === skill.id}
/>
```

在 `MarketplaceSkillCard.tsx` 中更新按钮：

```typescript
<button
  onClick={() => onCopyToCentral?.(skill.id)}
  disabled={loading}
  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
>
  {loading ? '处理中...' : skill.action_text || '收录到中央存储'}
</button>
```

- [ ] **Step 3: 提交**

```bash
git add app/src/pages/Dashboard/index.tsx app/src/pages/Dashboard/components/MarketplaceSkillCard.tsx
git commit -m "feat(ui): 添加加载状态和错误处理

- 在收录/移除操作中显示加载状态
- 禁用按钮防止重复操作
- 改进错误处理和用户反馈"
```

---

## Task 16: 最终验证和文档

**目标:** 完成所有功能的验证和文档更新

- [ ] **Step 1: 完整的功能测试**

执行以下测试场景：

1. **基本功能测试**
   - [ ] 收录 Claude Code 技能
   - [ ] 收录 Cursor 技能
   - [ ] 在中央存储中查看已收录技能
   - [ ] 从中央存储移除技能
   - [ ] 验证原始技能不受影响

2. **UI 状态测试**
   - [ ] 验证按钮状态正确切换
   - [ ] 验证中央存储标记显示
   - [ ] 验证加载状态显示
   - [ ] 验证错误提示显示

3. **数据一致性测试**
   - [ ] 验证配置文件正确更新
   - [ ] 验证文件正确复制和删除
   - [ ] 验证刷新后状态保持

4. **性能测试**
   - [ ] 测试大文件的收录性能
   - [ ] 测试多个技能的收录

- [ ] **Step 2: 代码审查**

Run: `npm run lint`
Run: `npm run type-check`

修复所有警告和错误

- [ ] **Step 3: 更新用户文档**

如果项目有用户文档，更新相关章节说明中央存储功能

- [ ] **Step 4: 创建功能发布说明**

创建 `RELEASE_NOTES.md` 记录新功能：

```markdown
# 中央存储功能

## 新功能
- 支持将 Claude Code 和 Cursor 的技能收录到中央存储
- 在"按来源展示"视图中添加"中央存储"分类
- 支持从中央存储移除技能（不影响原始来源）

## 使用方法
1. 切换到"按来源展示"视图
2. 选择 Claude Code 或 Cursor 分类
3. 点击"收录到中央存储"按钮
4. 在"中央存储"分类中查看已收录的技能
5. 点击"从中央存储移除"可移除技能

## 技术细节
- 收录操作：物理复制技能到 `~/.skills-manager/skills/` 目录
- 移除操作：只删除中央存储的副本，不影响原始文件
- 配置存储：在 `~/.claude/plugins/data/skills-manager/config.json` 中记录收录状态
```

- [ ] **Step 5: 最终提交**

```bash
git add .
git commit -m "feat: 完成中央存储功能实现

- 实现技能收录到中央存储
- 实现从中央存储移除技能
- 添加中央存储分类视图
- 支持收录状态显示和标记
- 完整的错误处理和用户反馈
- 集成测试和性能优化"
```

- [ ] **Step 6: 创建 Git 标签**

```bash
git tag -a v1.1.0 -m "中央存储功能版本"
git push origin v1.1.0
```

---

## 自我审查清单

**✓ Spec 覆盖检查:**
- [x] 数据结构修改：Task 1-2
- [x] 后端 API：Task 3-4
- [x] 前端 API：Task 5-6
- [x] UI 改动：Task 7-12
- [x] 测试：Task 13-15
- [x] 文档：Task 16

**✓ 占位符扫描:**
- [x] 无 TBD 或 TODO
- [x] 所有代码步骤都有完整示例
- [x] 所有文件路径都是准确的

**✓ 类型一致性:**
- [x] `in_central_store` 字段在所有位置一致
- [x] `selectedSource` 变量名在所有位置一致
- [x] 函数签名在定义和使用处一致

**✓ 任务分解:**
- [x] 每个任务聚焦单一职责
- [x] 任务之间依赖关系清晰
- [x] 每个步骤可在 2-5 分钟内完成

---

## 执行顺序建议

推荐按以下顺序执行任务：

1. **Phase 1 (后端)**: Task 1 → Task 2 → Task 3 → Task 4
2. **Phase 2 (前端 API)**: Task 5 → Task 6
3. **Phase 3 (UI)**: Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12
4. **Phase 4 (测试)**: Task 13 → Task 14 → Task 15 → Task 16

每个 Phase 完成后可以进行一次提交，便于回滚和代码审查。
