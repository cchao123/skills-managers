# 中央存储功能设计文档

**日期:** 2026-04-12
**作者:** Claude Sonnet
**状态:** 设计阶段

## 1. 概述

### 1.1 目标

实现技能的中央存储功能，允许用户将 Cursor 和 Claude Code 的技能复制到中央存储目录，并提供统一的界面进行管理。

### 1.2 核心功能

1. **分类展示**: 在"按来源展示"视图中，添加"中央存储"分类标签
2. **收录功能**: 用户可以将 Cursor/Claude Code 的技能复制到中央存储
3. **移除功能**: 用户可以从中央存储移除技能（不影响原始来源）
4. **状态标记**: 已收录的技能在原始分类中显示"已收录"状态

### 1.3 用户场景

- 用户在 Cursor 下发现一个有用的技能
- 用户点击"收录到中央存储"
- 技能被复制到 `~/.skills-manager/skills/` 目录
- 用户可以在"中央存储"分类中查看和管理该技能
- 用户可以随时从中央存储移除技能，原始文件不受影响

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SearchFilter │  │   SkillCard  │  │  Dashboard   │  │
│  │     Bar      │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Tauri IPC Layer                      │
├─────────────────────────────────────────────────────────┤
│  copy_skill_to_central() │ remove_skill_from_central()  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (Rust)                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  File Copy   │  │ File Delete  │  │   Config     │  │
│  │    Logic     │  │    Logic     │  │  Manager     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

**收录流程:**
```
用户点击按钮
  → 前端调用 copy_skill_to_central(skill_id)
  → 后端读取技能元数据
  → 后端复制技能目录到 ~/.skills-manager/skills/
  → 后端更新配置 (in_central_store: true)
  → 前端刷新技能列表
  → UI 更新显示状态
```

**移除流程:**
```
用户点击移除
  → 前端调用 remove_skill_from_central(skill_id)
  → 后端删除 ~/.skills-manager/skills/{skill_id}/
  → 后端更新配置 (in_central_store: false)
  → 前端刷新技能列表
  → UI 更新显示状态
```

## 3. API 设计

### 3.1 Rust 后端命令

#### 3.1.1 copy_skill_to_central

```rust
/// 复制技能到中央存储
#[tauri::command]
async fn copy_skill_to_central(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**功能:**
- 扫描所有来源，查找指定的技能 ID
- 复制技能目录到 `~/.skills-manager/skills/{skill_id}/`
- 递归复制所有文件和子目录
- 保留原始文件权限
- 更新配置文件，标记 `in_central_store: true`

**错误处理:**
- 技能不存在: `Skill not found`
- 目标目录已存在: `Skill already in central store`
- 复制失败: `Failed to copy skill: {error}`

#### 3.1.2 remove_skill_from_central

```rust
/// 从中央存储移除技能
#[tauri::command]
async fn remove_skill_from_central(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**功能:**
- 删除 `~/.skills-manager/skills/{skill_id}/` 目录
- 递归删除所有文件和子目录
- 更新配置文件，标记 `in_central_store: false`

**错误处理:**
- 技能不在中央存储: `Skill not in central store`
- 删除失败: `Failed to remove skill: {error}`

### 3.2 数据结构修改

#### 3.2.1 后端 (Rust)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    // ... 现有字段
    /// 是否已在中央存储
    #[serde(default)]
    pub in_central_store: bool,
}
```

#### 3.2.2 前端 (TypeScript)

```typescript
interface SkillMetadata {
  // ... 现有字段
  /** 是否已在中央存储 */
  in_central_store?: boolean;
}
```

#### 3.2.3 配置文件

在 `AppConfig` 中添加：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    // ... 现有字段
    /// 已收录到中央存储的技能 ID 列表
    #[serde(default)]
    pub central_store_skills: HashSet<String>,
}
```

## 4. UI 设计

### 4.1 分类标签栏

**位置:** `SearchAndFilterBar.tsx`

**标签列表:**
- 全部: 显示所有技能
- Claude Code: 显示 `source: 'claude'` 的技能
- Cursor: 显示 `source: 'cursor'` 的技能
- 中央存储: 显示 `in_central_store: true` 的技能

**UI 示例:**
```
[🔍 搜索框] [Claude Code] [Cursor] [中央存储] [全部] [📂]
```

### 4.2 技能卡片状态

**MarketplaceSkillCard.tsx** 根据 `source` 和 `in_central_store` 显示不同状态：

| 来源 | 已收录 | 按钮文字 | 按钮状态 | 标记 |
|------|--------|----------|----------|------|
| Claude/Cursor | 否 | "收录到中央存储" | 可点击 | 无 |
| Claude/Cursor | 是 | "收录到中央存储" | 禁用 | "已收录到中央存储" |
| Central | - | "从中央存储移除" | 可点击 | "中央存储" |

### 4.3 用户交互流程

**场景 1: 收录技能**
1. 用户切换到 "Claude Code" 分类
2. 用户看到技能卡片，显示"收录到中央存储"按钮
3. 用户点击按钮
4. 显示加载状态
5. 完成后显示成功提示
6. 按钮变为禁用状态，显示"已收录到中央存储"标记

**场景 2: 移除技能**
1. 用户切换到 "中央存储" 分类
2. 用户看到技能卡片，显示"从中央存储移除"按钮
3. 用户点击按钮
4. 显示确认对话框（可选）
5. 删除技能
6. 完成后显示成功提示
7. 技能从列表中移除

**场景 3: 查看已收录技能**
1. 用户切换到 "Claude Code" 分类
2. 已收录的技能显示"已收录到中央存储"标记
3. 按钮禁用，显示"收录到中央存储"（灰色）

## 5. 文件操作

### 5.1 目录结构

```
~/.skills-manager/
└── skills/
    ├── skill-1/
    │   └── SKILL.md
    ├── skill-2/
    │   ├── SKILL.md
    │   └── assets/
    │       └── icon.png
    └── skill-3/
        └── SKILL.md
```

### 5.2 复制逻辑

使用 Rust 的 `fs::extra::copy_items` 递归复制目录：

```rust
use std::fs;
use std::path::Path;

fn copy_skill_to_central(
    skill_path: &Path,
    central_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    // 创建目标目录
    fs::create_dir_all(central_path)?;

    // 递归复制文件和目录
    for entry in walkdir::WalkDir::new(skill_path) {
        let entry = entry?;
        let source_path = entry.path();
        let relative = source_path.strip_prefix(skill_path)?;
        let target_path = central_path.join(relative);

        if source_path.is_dir() {
            fs::create_dir_all(&target_path)?;
        } else {
            fs::copy(source_path, &target_path)?;
        }
    }

    Ok(())
}
```

### 5.3 删除逻辑

使用 Rust 的 `fs::remove_dir_all` 递归删除目录：

```rust
use std::fs;

fn remove_skill_from_central(central_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if central_path.exists() {
        fs::remove_dir_all(central_path)?;
    }
    Ok(())
}
```

## 6. 测试计划

### 6.1 单元测试

**后端测试:**
- 测试技能复制功能
- 测试技能删除功能
- 测试配置更新功能
- 测试错误处理

### 6.2 集成测试

- 测试完整的收录流程
- 测试完整的移除流程
- 测试 UI 状态更新

### 6.3 手动测试

1. 在 Cursor 下收录一个技能
2. 验证技能出现在中央存储分类
3. 验证技能在原始分类显示"已收录"
4. 从中央存储移除技能
5. 验证技能恢复为可收录状态
6. 验证原始文件不受影响

## 7. 性能考虑

### 7.1 大文件处理

- 对于包含大量文件的技能，复制可能需要较长时间
- 考虑添加进度指示器
- 考虑后台处理

### 7.2 并发控制

- 防止同时收录同一个技能
- 防止在收录过程中删除技能

## 8. 安全考虑

### 8.1 路径验证

- 验证技能 ID，防止路径遍历攻击
- 验证源路径和目标路径

### 8.2 权限管理

- 确保用户有权限读写目标目录
- 处理权限错误

## 9. 实现顺序

### Phase 1: 后端实现
1. 修改 `SkillMetadata` 数据结构
2. 实现 `copy_skill_to_central` 命令
3. 实现 `remove_skill_from_central` 命令
4. 更新配置管理逻辑
5. 编写单元测试

### Phase 2: 前端 API
1. 在 `tauri.ts` 中添加 API 调用
2. 更新 TypeScript 类型定义
3. 添加错误处理

### Phase 3: UI 实现
1. 修改 `SearchAndFilterBar.tsx` 添加中央存储标签
2. 修改 `MarketplaceSkillCard.tsx` 支持新状态
3. 实现收录/移除按钮逻辑
4. 添加加载状态和错误提示

### Phase 4: 集成测试
1. 端到端测试
2. 手动测试
3. 性能测试

## 10. 未来改进

- 支持批量收录/移除
- 支持技能更新（从中央存储同步到其他来源）
- 支持技能版本管理
- 添加技能依赖管理
