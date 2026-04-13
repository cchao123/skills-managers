# 按来源展示视图改造 & 中央存储收录状态

**日期:** 2026-04-12
**状态:** 已确认

## 1. 概述

改造「按来源展示」tab 的过滤逻辑，将现有 Agent 过滤按钮替换为来源过滤按钮（Claude Code / Cursor / 中央存储），并为中央存储视图添加「收录/已收录」纯展示状态。

## 2. 需求

1. 保留 tab 名「按来源展示」
2. 过滤按钮改为：Claude Code / Cursor / 中央存储 / 全部
3. Claude Code / Cursor：按 `source` 过滤，复用现有 MarketplaceSkillCard（Install/Installed）
4. 中央存储：按 `source === 'central'` 过滤，卡片将 Install 按钮替换为纯展示标签：
   - **已收录**：skill 目录物理存在于 `~/.claude/skills/` 或 `~/.cursor/skills/` 中（非 symlink）
   - **收录**：不存在
   - 两者都不可点击

## 3. 后端改动

### 3.1 models.rs — SkillMetadata 新增字段

```rust
/// 是否已被收录（物理复制）到 Agent 的 skills 目录中
/// 仅 source=Central 时有意义
#[serde(default)]
pub is_collected: bool,
```

### 3.2 scanner.rs — 扫描时计算 is_collected

在 `scan_all_skill_sources` 中，对 `source === Central` 的 skill：

1. 获取已配置的 agents 列表（claude、cursor）
2. 对每个 agent，检查 `{agent.skills_path}/{skill_id}/` 是否存在且**不是 symlink**
3. 任一 agent 目录下物理存在 → `is_collected = true`
4. 其他来源的 skill 默认 `is_collected = false`

判断"物理存在而非 symlink"的 Rust 代码：
```rust
fn is_physical_dir(path: &Path) -> bool {
    path.is_dir() && !path.is_symlink()
}
```

## 4. 前端改动

### 4.1 types/index.ts — SkillMetadata 新增字段

```typescript
is_collected?: boolean;
```

### 4.2 SearchAndFilterBar.tsx — 替换过滤按钮

`viewMode === 'agent'` 时，将 Agent 过滤按钮替换为来源过滤：

| 按钮 | 筛选条件 | 图标 |
|------|----------|------|
| Claude Code | `source === 'claude'` | 复用现有 claude icon |
| Cursor | `source === 'cursor'` | 复用现有 cursor icon |
| 中央存储 | `source === 'central'` | `inventory_2` |
| 全部 | 不筛选 | 保留 |

### 4.3 Dashboard/index.tsx — 筛选逻辑

`viewMode === 'agent'` 时：
- 根据 `selectedSource`（替代原 `selectedAgent`）过滤 `source` 字段
- 传入 `collectedStatus` prop 给 MarketplaceSkillCard

### 4.4 MarketplaceSkillCard.tsx — 新增收录标签

新增可选 prop：

```typescript
interface MarketplaceSkillCardProps {
  skill: Skill;
  onInstall: (skillId: string) => void;
  onInfo: (skillId: string) => void;
  collectedStatus?: 'collected' | 'uncollected';  // 新增
}
```

当 `collectedStatus` 存在时：
- 隐藏 Install 按钮
- 显示不可点击的灰色标签：
  - `'collected'` → 「已收录」（绿色/蓝色调）
  - `'uncollected'` → 「收录」（灰色）

## 5. 不做的事情

- 不新增 copy/remove Tauri 命令（中央存储视图纯展示）
- 不修改 AppConfig 数据结构
- 不修改 SkillCard（平铺展示视图不变）
- 不修改现有 Install/Installed 逻辑

## 6. 实现步骤

1. `models.rs`：添加 `is_collected` 字段
2. `scanner.rs`：扫描时计算 `is_collected`
3. `types/index.ts`：添加 `is_collected`
4. `skillAdapter.ts`：映射 `is_collected` 字段
5. `SearchAndFilterBar.tsx`：替换过滤按钮
6. `Dashboard/index.tsx`：更新筛选逻辑，传 collectedStatus
7. `MarketplaceSkillCard.tsx`：添加收录标签渲染
