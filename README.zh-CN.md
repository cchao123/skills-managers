# Claude Code 技能管理器

[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=000)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey)](README.md)

一个使用 Tauri 2、React 和 TypeScript 构建的桌面应用程序，用于管理 Claude Code 技能和插件。

## 功能特性

### 🎛️ 仪表板
- 在一个位置查看所有已安装的 Claude Code 技能
- 实时统计（总计、已启用、已禁用的技能）
- 一键启用/禁用技能
- 按名称、描述或插件名称搜索技能
- 按状态过滤技能（全部、已启用、已禁用）
- 查看技能详细信息，包括版本、来源和仓库

### 🏪 市场
- 浏览和发现来自社区的新技能
- 按类别过滤技能（开发者工具、生产力、AI/ML 等）
- 搜索技能、开发者或类别
- 直接安装技能到您的环境
- 使用 SDK 构建自定义技能的开发者 CTA

### 🔗 GitHub 集成
- 从 GitHub 添加自定义技能仓库
- 同步仓库以获取最新技能
- 配置分支、路径和身份验证
- 使用个人访问令牌支持私有仓库
- 导出配置以进行备份
- 确认后删除仓库

### ⚙️ 设置
- **外观**：在浅色、深色和自动主题之间切换
- **语言**：支持英语和中文
- **关于**：应用程序信息和版本详情
- **更新日志**：查看发布说明和版本历史

### 🌐 附加功能
- 跨平台支持（macOS 和 Windows）
- 响应式设计，支持深色模式
- 国际化（i18n）支持
- Material Symbols 图标
- 支持模拟数据用于浏览器测试

## 技术栈

### 前端
- **React 18**：带有 Hooks 的 UI 框架
- **TypeScript**：类型安全的 JavaScript
- **Vite 5**：快速构建工具和开发服务器
- **Tailwind CSS**：实用优先的 CSS 框架
- **Material Symbols**：Google 官方图标库
- **react-i18next**：国际化框架

### 后端
- **Rust**：系统编程语言
- **Tauri 2**：跨平台桌面框架
- **git2**：用于仓库管理的 Git 操作
- **serde**：序列化框架
- **anyhow**：错误处理

### 开发工具
- **npm**：包管理器
- **cargo**：Rust 包管理器
- **Tauri CLI**：构建和开发工具

## 快速开始

### 前置要求

- **Node.js 18+** 和 npm
- **Rust 工具链**（用于构建 Tauri）
- **OpenSSL**（在 macOS 上通过 Homebrew）：
  ```bash
  brew install openssl@3
  export OPENSSL_DIR=$(brew --prefix openssl@3)
  export PKG_CONFIG_PATH=$(brew --prefix openssl@3)/lib/pkgconfig
  ```

### 安装

1. 克隆仓库：
```bash
git clone <repository-url>
cd skills-manager
```

2. 安装依赖：
```bash
npm install
```

3. 构建 Rust 依赖：
```bash
cargo build --manifest-path=src-tauri/Cargo.toml
```

### 开发

运行开发服务器：
```bash
npm run tauri:dev
```

这将：
1. 在 http://localhost:5173 启动 Vite 开发服务器
2. 启动 Tauri 应用程序窗口
3. 为前端和后端更改启用热重载

**提示**：应用程序包含用于浏览器测试的模拟数据。如果在浏览器中运行，它将自动使用模拟数据而不是调用 Tauri 命令。

## 构建

### 构建 macOS（通用二进制文件）：
```bash
npm run tauri:build --target universal-apple-darwin
```

### 构建 macOS（仅 Intel）：
```bash
npm run tauri:build --target x86_64-apple-darwin
```

### 构建 macOS（仅 Apple Silicon）：
```bash
npm run tauri:build --target aarch64-apple-darwin
```

### 构建 Windows：
```bash
npm run tauri:build --target x86_64-pc-windows-msvc
```

### 仅构建 Rust（后端更改更快）：
```bash
cargo build --manifest-path=src-tauri/Cargo.toml
```

构建的应用程序将在 `src-tauri/target/release/bundle/` 中。

## 故障排除

### "Icon not RGBA" 错误
Tauri 需要 RGBA 格式的 PNG 图标。使用以下命令生成：
```bash
npx @tauri-apps/cli icon <input.svg>
```

### 端口 5173 已被占用
终止进程：
```bash
lsof -ti:5173 | xargs kill -9
```

### macOS 上的 OpenSSL 错误
确保通过 Homebrew 安装了 OpenSSL 并设置了环境变量：
```bash
export OPENSSL_DIR=$(brew --prefix openssl@3)
export PKG_CONFIG_PATH=$(brew --prefix openssl@3)/lib/pkgconfig
```

### 技能未出现
1. 检查 `~/.claude/settings.json` 中的插件名称是否正确
2. 验证技能文件具有正确的带有 frontmatter 的 `SKILL.md`
3. 使用仪表板中的重新扫描按钮刷新技能列表
4. 检查控制台是否有错误消息

## 开发技巧

### 添加新页面
1. 在 `app/src/pages/` 中创建页面组件
2. 在 `App.tsx` 状态管理中添加路由
3. 在 `Sidebar.tsx` 中添加导航项
4. 在 `app/src/i18n/locales/` 中添加翻译

### 添加新的 Tauri 命令
1. 在 `src-tauri/src/commands/` 中使用 `#[tauri::command]` 定义函数
2. 在 `src-tauri/src/main.rs` 中注册：
   ```rust
   tauri::generate_handler![
       // 现有命令
       your_new_command
   ]
   ```
3. 在 `app/src/api/tauri.ts` 中添加前端包装器
4. 在 React 组件中使用并进行错误处理

### 用于测试的模拟数据
应用程序包含用于浏览器测试的模拟数据支持。模拟数据定义在：
- `app/src/data/mockSkills.ts`：市场技能
- 组件文件：Dashboard 和 GitHubBackup 具有内联模拟数据

当在浏览器中（非 Tauri）运行时，应用程序会自动使用模拟数据。

## 项目结构

```
skills-manager/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # Tauri 入口点
│   │   ├── models.rs       # 数据模型
│   │   ├── scanner.rs      # 技能扫描器
│   │   ├── github.rs       # Git 操作
│   │   ├── settings.rs     # Claude Code 设置
│   │   └── commands/       # Tauri 命令
│   │       ├── skills.rs   # 技能相关命令
│   │       └── github.rs   # GitHub 相关命令
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── app/                    # React 前端
│   ├── src/
│   │   ├── main.tsx        # 应用入口点
│   │   ├── App.tsx         # 主应用组件
│   │   ├── components/     # 可重用组件
│   │   │   ├── PageHeader.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SkillCard.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.tsx     # 技能管理
│   │   │   ├── Marketplace.tsx   # 技能市场
│   │   │   ├── GitHubBackup.tsx  # GitHub 仓库
│   │   │   └── Settings.tsx      # 应用设置
│   │   ├── api/            # Tauri API 包装器
│   │   │   └── tauri.ts
│   │   ├── contexts/       # React 上下文
│   │   │   └── ThemeContext.tsx
│   │   ├── types/          # TypeScript 类型
│   │   ├── data/           # 模拟数据
│   │   │   └── mockSkills.ts
│   │   └── i18n/           # 国际化
│   │       └── locales/    # 语言文件
│   │           ├── en.json
│   │           └── zh.json
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

## 使用方法

### 仪表板 - 管理技能

1. **查看技能**：所有已安装的技能以卡片网格布局显示
2. **搜索**：使用搜索栏按名称、描述或插件名称查找技能
3. **过滤**：按状态过滤技能：
   - 全部：显示所有技能
   - 已启用：仅显示已启用的技能
   - 已禁用：仅显示已禁用的技能
4. **切换技能**：单击每个技能卡上的启用/禁用按钮
5. **技能详情**：每张卡片显示：
   - 技能名称和描述
   - 插件名称和版本
   - 来源（市场/GitHub/本地）
   - 仓库 URL（如果适用）
   - 当前状态（已启用/已禁用）

### 市场 - 发现技能

1. **浏览**：探索来自社区的可用技能
2. **搜索**：按名称、描述或类别查找技能
3. **按类别过滤**：单击类别按钮进行过滤：
   - 全部
   - 开发者工具
   - 生产力
   - AI/ML
   - 实用工具
   - 文档
4. **安装技能**：单击技能卡片上的"安装"（即将推出）
5. **查看信息**：单击信息图标查看技能详情

### GitHub 集成 - 管理仓库

1. **添加仓库**：
   - 单击"添加仓库"按钮
   - 填写表单：
     - 名称：友好的标识符（例如，"my-skills"）
     - 所有者：GitHub 用户名或组织
     - 仓库：仓库名称
     - 分支：Git 分支（默认：main）
     - 技能路径：技能目录路径（默认：skills）
     - 个人访问令牌：可选，用于私有仓库
   - 单击"添加仓库"

2. **同步仓库**：
   - 单击仓库卡片上的"同步"按钮
   - 将从 GitHub 拉取最新更改
   - 技能将在仪表板中更新

3. **删除仓库**：
   - 单击仓库卡片上的"删除"
   - 确认删除
   - 仓库及其技能将被删除

### 设置 - 应用配置

1. **外观**：
   - 浅色：始终使用浅色主题
   - 深色：始终使用深色主题
   - 自动：跟随系统偏好

2. **语言**：
   - English：英语界面
   - 中文：中文界面

3. **关于**：
   - 查看应用版本和信息
   - 链接到 GitHub 和文档

4. **更新日志**：
   - 查看版本历史
   - 查看新功能和修复

## 配置

### Claude Code 设置

当您启用/禁用技能时，应用程序会自动修改 `~/.claude/settings.json`：

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "code-runner@claude-plugins-official": false
  }
}
```

### GitHub 配置

GitHub 仓库配置存储在 `~/.claude/plugins/data/skills-manager/github-config.json` 中：

```json
{
  "repositories": {
    "my-custom-skills": {
      "owner": "username",
      "repo": "custom-skills",
      "branch": "main",
      "path": "skills",
      "enabled": true,
      "last_sync": "2024-03-29T10:30:00Z"
    }
  }
}
```

### 技能文件位置

- **市场技能**：`~/.claude/plugins/cache/[marketplace]/[plugin]/[version]/skills/`
- **GitHub 技能**：`~/.claude/skills-manager/[repo-name]/skills/`
- **本地技能**：`~/.claude/skills-manager/[project-name]/skills/`

### 技能文件格式

技能在 `SKILL.md` 文件中使用 YAML frontmatter 定义：

```yaml
---
name: skill-name
description: 技能描述
---
```

没有 frontmatter 的技能使用目录名称作为后备。

## 许可证

MIT 许可证 - 有关详细信息，请参阅 LICENSE 文件

## 贡献

欢迎贡献！请随时提交 Pull Request。

### 贡献领域
- 新功能和改进
- 错误修复
- 文档更新
- 国际化（添加更多语言）
- UI/UX 改进
- 性能优化

### 开发工作流程
1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 进行更改
4. 提交：`git commit -m 'Add some feature'`
5. 推送：`git push origin feature/my-feature`
6. 打开 Pull Request

## 致谢

- 使用 [Tauri](https://tauri.app/) 构建
- 图标来自 [Material Symbols](https://fonts.google.com/icons)
- 灵感来自 [Claude Code](https://claude.ai/code)

## 支持

如有问题、疑问或建议：
- 在 GitHub 上提出问题
- 查看现有文档
- 加入社区论坛
