# Skills Manager 使用说明书

## 简介

Skills Manager 是一款桌面端应用（macOS / Windows），用于管理 AI 编程助手的技能（Skills/Plugins）。支持 Claude Code、Cursor、Codex、OpenClaw、OpenCode 等主流 Agent。

应用基于 Tauri 2 + React 构建，体积小、性能好，支持中文和英文界面、深色模式。

---

## 快速开始

1. 从 [GitHub Releases](https://github.com/cchao123/skills-managers/releases) 下载最新版本
2. 安装并启动应用
3. 应用会自动扫描本地的 Agent 目录，识别已安装的技能

---

## 功能概览

应用由三个页面组成：

| 页面 | 功能 |
|------|------|
| **已安装技能** | 查看、启用/禁用、导入、删除技能 |
| **GitHub 备份** | 将技能同步到 GitHub 仓库，或从远端恢复 |
| **设置** | 语言、主题、Agent 管理、关于 |

---

## 1. 已安装技能（Dashboard）

### 1.1 视图切换

页面顶部右侧提供两种视图模式：

- **平铺展示**：所有来源的技能去重后以双列瀑布流展示。重复技能自动合并（优先级：全局 > Claude > Cursor）。
- **按来源展示**：按技能来源分组展示，可通过来源标签筛选。

### 1.2 搜索与筛选

- **搜索栏**：按技能名称和描述进行模糊搜索
- **统计条**（平铺展示）：显示「全部 / 已启用 / 已禁用」的计数，点击可筛选
- **来源标签**（按来源展示）：切换查看不同来源的技能

### 1.3 技能卡片操作

每个技能卡片包含：

- **主开关**：全局启用/禁用技能，自动级联到各 Agent
  - 关闭时：备份各 Agent 的独立状态，然后全部禁用
  - 开启时：恢复之前备份的状态
- **展开面板**：展开后可对每个 Agent 单独启用/禁用
- **详情按钮**：打开技能详情弹窗

### 1.4 技能详情弹窗

包含以下区域：

- **文件树 + 内容预览**（可拖拽调整分栏大小）
  - 左侧：技能文件的目录树，点击切换文件
  - 右侧：文件内容预览（等宽字体渲染）
- **Agent 启用状态**：各 Agent 的独立开关
- **删除按钮**（仅限全局来源的技能）

### 1.5 拖拽导入

将包含 `SKILL.md` 的文件夹直接拖入应用窗口即可导入：

1. 拖入时显示「释放安装」提示
2. 释放后自动导入，显示进度提示
3. 导入完成后弹出成功/失败通知
4. 支持同时拖入多个文件夹

### 1.6 打开文件夹

点击搜索栏右侧的文件夹图标，可跳转到 **设置 > Agents** 页面管理各 Agent 的目录。

---

## 2. GitHub 备份

### 2.1 配置步骤

1. **创建 GitHub 仓库**：在 GitHub 上新建一个空仓库
2. **生成 Personal Access Token**：前往 [GitHub Token 设置](https://github.com/settings/personal-access-tokens)，生成具有 `repo` 权限的 Token
3. **填写配置表单**：
   - **仓库所有者 / 仓库名**：如 `cchao123/my-skills`
   - **分支**：默认 `main`
   - **Token**：粘贴刚才生成的 Token
4. **测试连接**：点击「测试连接」按钮验证配置

### 2.2 同步到 GitHub

点击「立即同步」将本地技能推送到 GitHub 仓库：

- **正常同步**：仅推送变更的文件
- **覆盖远端**：点击下拉箭头勾选「以本地版本覆盖远程」，强制推送本地内容。此操作会弹出二次确认框。

### 2.3 从 GitHub 恢复

点击「从 GitHub 恢复」将远端技能拉取到本地：

- **正常恢复**：远端同名文件覆盖本地，本地独有的文件保留
- **覆盖本地**：点击下拉箭头勾选「以远端版本覆盖本地」，本地多出的文件将被删除。此操作会弹出二次确认框。

### 2.4 其他功能

- **Star 按钮**：右上角可给 Skills Manager 项目加星
- **打开本地目录**：右上角打开 `~/.skills-manager` 目录
- **状态徽章**：连接后显示可点击的 GitHub 仓库链接

### 2.5 分享给他人

页面底部的「分享给他人」区块提供了两条命令，他人可通过 Claude Code 安装你的技能：

1. 注册 Marketplace：
   ```
   /plugin marketplace add owner/repo
   ```
2. 安装技能：
   ```
   /plugin install <skill-name>@owner/repo
   ```

---

## 3. 设置

### 3.1 General（通用）

#### 语言

支持中文和英文切换，切换后界面和系统托盘菜单同步更新。

#### 外观

三种主题模式：

- **浅色**：始终使用浅色主题
- **深色**：始终使用深色主题
- **跟随系统**：自动适配系统深色模式设置

### 3.2 Agents

显示所有支持的 AI 编程助手：

| Agent | 名称 | 配置目录 |
|-------|------|---------|
| Claude Code | Claude | ~/.claude |
| Cursor | Cursor | ~/.cursor |
| Codex | Codex | ~/.codex |
| OpenClaw | OpenClaw | ~/.openclaw |
| OpenCode | OpenCode | ~/.opencode |

- **已安装**的 Agent：显示绿色徽章，点击可打开其配置目录
- **未安装**的 Agent：显示灰色徽章，不可点击

页面底部有 Skills Manager 自身的卡片（章鱼图标），点击打开 `~/.skills-manager` 目录。

### 3.3 About（关于）

显示应用版本信息和相关链接。

---

## 4. 技能文件格式

每个技能是一个文件夹，必须包含 `SKILL.md` 文件。`SKILL.md` 使用 YAML frontmatter 格式：

```markdown
---
name: my-skill
description: 技能的简要描述
---

# My Skill

技能的具体内容...
```

### 技能存放路径

| 来源 | 路径 |
|------|------|
| Skills Manager 全局 | `~/.skills-manager/skills/` |
| Claude Code 插件缓存 | `~/.claude/plugins/cache/` |
| Claude Code 自定义 | `~/.claude/skills/` |
| Cursor | `~/.cursor/skills/` |

---

## 5. 常见问题

### 连接 GitHub 失败

- 检查 Token 是否具有 `repo` 权限
- 确认仓库所有者和仓库名拼写正确
- 确认分支名称正确（默认 `main`）
- 检查网络连接

### 同步冲突

默认情况下，同步时远端版本优先。如需以本地为准，勾选「以本地版本覆盖远程」。

### Agent 未检测到

应用通过检测 `~/.claude`、`~/.cursor` 等目录是否存在来判断 Agent 是否安装。如果已安装但未检测到，请确认安装路径正确。

### 导入技能失败

确保导入的文件夹根目录包含 `SKILL.md` 文件，且 frontmatter 格式正确。
