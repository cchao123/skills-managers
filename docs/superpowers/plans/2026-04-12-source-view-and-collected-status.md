# 按来源展示改造 & 收录状态 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造「按来源展示」tab 的过滤按钮为来源筛选（Claude Code / Cursor / 中央存储），并为中央存储的 skill 添加「收录/已收录」纯展示标签。

**Architecture:** 后端在 `SkillMetadata` 新增 `is_collected` 字段，扫描时通过检查 agent 目录下是否存在物理（非 symlink）目录来计算。前端将 Agent 过滤按钮替换为来源过滤按钮，中央存储视图下卡片显示不可点击的收录标签。

**Tech Stack:** Rust (Tauri 2), React 18, TypeScript, Tailwind CSS

---

### Task 1: 后端 — SkillMetadata 新增 `is_collected` 字段

**Files:**
- Modify: `src-tauri/src/models.rs:18-43` (SkillMetadata struct)
- Modify: `src-tauri/src/models.rs:144` (Frontmatter 不变)

- [ ] **Step 1: 在 SkillMetadata struct 中添加 `is_collected` 字段**

在 `src-tauri/src/models.rs` 的 `SkillMetadata` struct 中，`source` 字段后面添加：

```rust
    /// 是否已被物理收录到 Agent 的 skills 目录中（非 symlink）
    #[serde(default)]
    pub is_collected: bool,
```

- [ ] **Step 2: 更新 scanner.rs 中所有创建 SkillMetadata 的地方，添加 `is_collected: false`**

在 `src-tauri/src/scanner.rs` 的 `parse_skill_md` 函数中（约第 71-87 行），在 `source,` 后面添加 `is_collected: false,`：

```rust
    Ok(SkillMetadata {
        id,
        name,
        description,
        category,
        author,
        version,
        repository: None,
        enabled: true,
        agent_enabled: HashMap::new(),
        agent_enabled_backup: None,
        installed_at: last_updated.clone(),
        last_updated,
        source,
        is_collected: false,  // 将在 scan_all_skill_sources 中更新
        path: Some(skill_path),
    })
```

- [ ] **Step 3: 运行 cargo check 验证编译通过**

Run: `cd /Users/cchao/project/skills-managers && cargo check --manifest-path=src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/scanner.rs
git commit -m "feat: add is_collected field to SkillMetadata"
```

---

### Task 2: 后端 — 在 `scan_all_skill_sources` 中计算 `is_collected`

**Files:**
- Modify: `src-tauri/src/scanner.rs:244-366` (scan_all_skill_sources 函数)

- [ ] **Step 1: 添加辅助函数 `is_physical_dir`**

在 `src-tauri/src/scanner.rs` 中，`expand_tilde` 函数之前（约第 367 行），添加：

```rust
/// 检查路径是否为物理目录（非符号链接）
fn is_physical_dir(path: &std::path::Path) -> bool {
    path.is_dir() && !path.is_symlink()
}

/// 检查 skill 是否被物理收录到任一 agent 目录中
fn check_skill_collected(skill_id: &str, agents: &[crate::models::AgentConfig]) -> bool {
    let home_dir = match dirs::home_dir() {
        Some(h) => h,
        None => return false,
    };

    for agent in agents {
        let agent_path = if agent.path.starts_with("~/") {
            home_dir.join(&agent.path[2..])
        } else if agent.path.starts_with("~") {
            home_dir.join(&agent.path[1..])
        } else {
            home_dir.join(&agent.path)
        };

        let skill_in_agent = agent_path.join(&agent.skills_path).join(skill_id);
        if is_physical_dir(&skill_in_agent) {
            return true;
        }
    }
    false
}
```

- [ ] **Step 2: 修改 `scan_all_skill_sources` 函数签名，接受 agents 参数**

将函数签名从：

```rust
pub fn scan_all_skill_sources(
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
) -> Result<Vec<SkillMetadata>, ScannerError> {
```

改为：

```rust
pub fn scan_all_skill_sources(
    skill_states: &std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    agents: &[crate::models::AgentConfig],
) -> Result<Vec<SkillMetadata>, ScannerError> {
```

- [ ] **Step 3: 在 `scan_all_skill_sources` 末尾（排序之前）添加 is_collected 计算逻辑**

在 `all_skills.sort_by(...)` 之前添加：

```rust
    // 计算 is_collected 状态（仅对 Central 来源有意义）
    for skill in &mut all_skills {
        if skill.source == SkillSource::Central {
            skill.is_collected = check_skill_collected(&skill.id, agents);
        }
    }
```

- [ ] **Step 4: 更新所有调用 `scan_all_skill_sources` 的地方，传入 agents 参数**

需要更新以下文件中的调用点：

**`src-tauri/src/commands/skills.rs`** — 所有调用 `scanner::scan_all_skill_sources` 的地方（约 6 处），将：
```rust
scanner::scan_all_skill_sources(&config.skill_states)
```
改为：
```rust
scanner::scan_all_skill_sources(&config.skill_states, &config.agents)
```

涉及函数：`list_skills`, `enable_skill`, `disable_skill`, `get_skill_files`, `read_skill_file`, `delete_skill`

**`src-tauri/src/main.rs`** — 两处调用（约第 53 行和第 124 行），将：
```rust
scanner::scan_all_skill_sources(&skill_states)
```
改为：
```rust
// 需要先获取 agents，可以在 detect_agents 之后从 config 拿
// 注意：main.rs 中的 settings_manager 已经调用了 detect_agents，所以可以用 config.agents
```

在 `main.rs` 的 `setup` 闭包中（约第 120-125 行），更新为：
```rust
let config = settings_manager.get_config().clone();
let skill_states = config.skill_states.clone();
let agents = config.agents.clone();

let _skills = scanner::scan_all_skill_sources(&skill_states, &agents)
    .unwrap_or_default();
```

同样更新 `rebuild_tray_menu` 函数（约第 51-53 行）：
```rust
let state = app.state::<AppState>();
let config = state.settings_manager.lock().unwrap().get_config().clone();
let skill_states = config.skill_states.clone();
let agents = config.agents.clone();
let skills = scanner::scan_all_skill_sources(&skill_states, &agents).unwrap_or_default();
```

- [ ] **Step 5: 运行 cargo check 验证编译通过**

Run: `cd /Users/cchao/project/skills-managers && cargo check --manifest-path=src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` without errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/scanner.rs src-tauri/src/commands/skills.rs src-tauri/src/main.rs
git commit -m "feat: compute is_collected status during skill scanning"
```

---

### Task 3: 前端 — 类型定义和适配器更新

**Files:**
- Modify: `app/src/types/index.ts:5-20` (SkillMetadata interface)
- Modify: `app/src/adapters/skillAdapter.ts:4-19` (BackendSkillMetadata interface)

- [ ] **Step 1: 在 `app/src/types/index.ts` 的 SkillMetadata 中添加 `is_collected`**

在 `source?: SkillSource;` 后面添加：

```typescript
  is_collected?: boolean;         // Whether skill is physically copied to any agent's skills dir
```

- [ ] **Step 2: 在 `app/src/adapters/skillAdapter.ts` 的 BackendSkillMetadata 和 adaptSkillMetadata 中添加映射**

在 `BackendSkillMetadata` interface 中 `path?: string;` 后面添加：

```typescript
  is_collected?: boolean;
```

在 `adaptSkillMetadata` 函数的返回对象中 `path:` 后面添加：

```typescript
    is_collected: backendData.is_collected,
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts app/src/adapters/skillAdapter.ts
git commit -m "feat: add is_collected to frontend types and adapter"
```

---

### Task 4: 前端 — 替换 SearchAndFilterBar 中的过滤按钮

**Files:**
- Modify: `app/src/pages/Dashboard/components/SearchAndFilterBar.tsx:65-104`
- Modify: `app/src/pages/Dashboard/index.tsx:31,37-39,78,101-106`

- [ ] **Step 1: 修改 Dashboard/index.tsx — 将 `selectedAgent` 改为 `selectedSource`**

将 `const [selectedAgent, setSelectedAgent] = useState<string>('All');` 改为：

```typescript
const [selectedSource, setSelectedSource] = useState<string>('All');
```

将 `viewTabs` 中的 `{ id: 'agent', label: '按来源展示', icon: 'smart_toy' }` 保留不变。

在 `handleViewModeChange` 中，将 `setSelectedAgent('All')` 改为 `setSelectedSource('All')`。

- [ ] **Step 2: 修改 Dashboard/index.tsx — 更新 agent 视图的过滤逻辑**

将原有的 `filteredByAgent` 替换为基于 `source` 的过滤：

```typescript
// 按来源过滤
const filteredBySource = selectedSource === 'All'
  ? filteredSkills
  : filteredSkills.filter(skill => {
      if (selectedSource === 'claude') return skill.source === 'claude';
      if (selectedSource === 'cursor') return skill.source === 'cursor';
      if (selectedSource === 'central') return skill.source === 'central';
      return true;
    });

const marketplaceSkills = filteredBySource.map(convertToMarketplaceSkill);
```

删除旧的 `filteredByAgent` 逻辑（约第 101-106 行）。

更新渲染中的引用：将 `filteredByAgent.map(...)` 和 `filteredByAgent.length === 0` 中的 `filteredByAgent` 全部替换为 `marketplaceSkills`。注意 `marketplaceSkills` 现在基于 `filteredBySource`，已经包含了 source 过滤。

- [ ] **Step 3: 修改 Dashboard/index.tsx — 传递 selectedSource 和 onSourceSelect 给 SearchAndFilterBar**

更新 props 传递：

```tsx
<SearchAndFilterBar
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  filterType={filterType}
  onFilterChange={setFilterType}
  skills={skills}
  viewMode={viewMode as 'flat' | 'agent'}
  selectedSource={selectedSource}
  onSourceSelect={setSelectedSource}
/>
```

注意：移除 `selectedAgent` 和 `onAgentSelect` props，替换为 `selectedSource` 和 `onSourceSelect`。也移除 `agents` prop（来源过滤不需要 agent 列表）。

- [ ] **Step 4: 修改 Dashboard/index.tsx — 给 MarketplaceSkillCard 传入 collectedStatus**

在 agent 视图渲染 MarketplaceSkillCard 的地方，添加 `collectedStatus` prop：

```tsx
{marketplaceSkills.map((skill) => {
  const originalSkill = filteredBySource.find(s => s.id === skill.id);
  const collectedStatus = originalSkill?.source === 'central'
    ? (originalSkill.is_collected ? 'collected' as const : 'uncollected' as const)
    : undefined;

  return (
    <MarketplaceSkillCard
      key={skill.id}
      skill={skill}
      onInstall={() => {
        const orig = skills.find(s => s.id === skill.id);
        if (orig) {
          handleToggleSkill(orig);
        }
      }}
      onInfo={() => handleShowSkillDetail(skills.find(s => s.id === skill.id)!)}
      collectedStatus={collectedStatus}
    />
  );
})}
```

- [ ] **Step 5: 修改 SearchAndFilterBar.tsx — 替换 Agent 过滤按钮为来源过滤按钮**

更新 props interface：

```typescript
interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'enabled' | 'disabled';
  onFilterChange: (type: 'all' | 'enabled' | 'disabled') => void;
  skills: SkillMetadata[];
  viewMode: 'flat' | 'agent';
  selectedSource: string;
  onSourceSelect: (source: string) => void;
}
```

将 `viewMode === 'agent'` 中的 Agent 按钮块（约第 65-104 行）替换为：

```tsx
{viewMode === 'agent' && (
  <div className="flex flex-wrap items-center gap-2">
    {[
      { id: 'claude', label: 'Claude Code', icon: getAgentIcon('claude') },
      { id: 'cursor', label: 'Cursor', icon: getAgentIcon('cursor') },
      { id: 'central', label: '中央存储', icon: null },
    ].map((item) => (
      <button
        key={item.id}
        onClick={() => onSourceSelect(item.id)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
          selectedSource === item.id
            ? 'bg-[#b71422] text-white font-bold'
            : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
        }`}
      >
        {item.icon ? (
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <img src={item.icon} alt={item.label} className="w-full h-full object-contain" />
          </div>
        ) : (
          <span className="material-symbols-outlined text-base">inventory_2</span>
        )}
        <span>{item.label}</span>
      </button>
    ))}
    <button
      onClick={() => onSourceSelect('All')}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        selectedSource === 'All'
          ? 'bg-[#b71422] text-white font-bold'
          : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
      }`}
    >
      <span className="text-base">🌐</span>
      <span>全部</span>
    </button>
  </div>
)}
```

- [ ] **Step 6: 验证前端编译通过**

Run: `cd /Users/cchao/project/skills-managers/app && npx tsc --noEmit 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/Dashboard/index.tsx app/src/pages/Dashboard/components/SearchAndFilterBar.tsx
git commit -m "feat: replace agent filter with source filter in by-source view"
```

---

### Task 5: 前端 — MarketplaceSkillCard 添加收录标签

**Files:**
- Modify: `app/src/pages/Dashboard/components/MarketplaceSkillCard.tsx`

- [ ] **Step 1: 添加 `collectedStatus` prop 并更新渲染逻辑**

将整个文件替换为：

```tsx
import { useState } from 'react';
import type { Skill } from '@/types/skills';

interface MarketplaceSkillCardProps {
  skill: Skill;
  onInstall: (skillId: string) => void;
  onInfo: (skillId: string) => void;
  collectedStatus?: 'collected' | 'uncollected';
}

function MarketplaceSkillCard({ skill, onInstall, onInfo, collectedStatus }: MarketplaceSkillCardProps) {
  return (
    <article className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 flex flex-col group overflow-hidden">
      <div className="p-4">
        {/* Icon + Version badge */}
        <div className="flex justify-between items-start mb-3">
          <div className={`w-12 h-12 rounded-lg ${skill.iconColor} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-2xl" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
              {skill.icon}
            </span>
          </div>
          <span className="text-[10px] font-bold py-0.5 px-1.5 bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-300 rounded uppercase">
            {skill.version}
          </span>
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

        {/* Buttons */}
        <div className="flex gap-2">
          {collectedStatus !== undefined ? (
            /* 收录标签 — 纯展示，不可点击 */
            <div className={`flex-1 py-2 rounded-lg font-bold text-xs text-center ${
              collectedStatus === 'collected'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-400 border border-[#e1e3e4] dark:border-dark-border'
            }`}>
              {collectedStatus === 'collected' ? '已收录' : '收录'}
            </div>
          ) : (
            /* Install 按钮 — 原有逻辑 */
            <button
              onClick={() => onInstall(skill.id)}
              className="flex-1 bg-[#b71422] text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
            >
              {skill.installed ? 'Installed' : 'Install'}
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

export default MarketplaceSkillCard;
```

- [ ] **Step 2: 验证前端编译通过**

Run: `cd /Users/cchao/project/skills-managers/app && npx tsc --noEmit 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Dashboard/components/MarketplaceSkillCard.tsx
git commit -m "feat: add collected status badge to MarketplaceSkillCard"
```

---

### Task 6: 全局验证

- [ ] **Step 1: 运行 Rust 编译检查**

Run: `cd /Users/cchao/project/skills-managers && cargo check --manifest-path=src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: `Finished` without errors

- [ ] **Step 2: 运行前端类型检查**

Run: `cd /Users/cchao/project/skills-managers/app && npx tsc --noEmit 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 3: 启动开发服务器做冒烟测试**

Run: `cd /Users/cchao/project/skills-managers && npm run tauri:dev`
Verify:
1. 平铺展示视图正常工作（不受影响）
2. 按来源展示视图显示三个来源按钮：Claude Code / Cursor / 中央存储
3. 点击各来源按钮，技能列表正确过滤
4. 中央存储视图下，卡片显示「收录」或「已收录」标签（不可点击）
5. Claude Code / Cursor 视图下，卡片显示 Install/Installed 按钮（原有行为）
