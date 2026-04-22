<div align="center">

<img src="docs/assets/logo.png" alt="Skills Manager" width="520" />

### <strong>一键共享 + 一键同步</strong>、在多Agent中更优雅的使用skill，并通过 <strong>Skills Manager</strong> 更优雅的管理并构建你的专属技能仓库。


[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=000)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/平台-macOS%20%7C%20Windows-lightgrey)](README.md)

<p>
  <strong>文档语言 / Readme language</strong><br />
  <b><a href="#zh">中文</a></b> · <a href="README.en.md">English</a>
</p>

<p><a href="https://github.com/cchao123/skills-managers/issues">意见反馈（GitHub Issues）</a></p>

</div>

---

<a id="zh"></a>

## 功能概览

### 已安装技列表

- **一键共享**：通过总开关/子开关链接至目标Agent；
- **多种试图**：汇总展示、高效管理已有Skill，快速查看Skill详情；
- **拖拽导入**： 支持文件夹拖入导入（需含 SKILL.md）

![主页](docs/screen-shot/zh-skills-home.png)
![主页](docs/screen-shot/zh-skills-source.png)
![技能详情](docs/screen-shot/zh-skills-detail.png)
![拖拽导入](docs/screen-shot/zh-skills-drop.png)

### GitHub 备份 / 构建Claude Code Marketplace

- **同步到 GitHub**：将中央存储技能推送到远端
- **从 GitHub 恢复**：在新机器上拉取仓库中的技能到本地
- **构建Marketplace**：备份后的仓库可作为Claude Code Marketplace提供他人使用。

![GitHub](docs/screen-shot/zh-github.png)

### 设置
- **记忆过滤**：在视图中过滤由cli/workflow 注入的skill，列表更清爽。
- **删除保护**：作为插件，默认无权限编辑Agent下文件，需要手动开启。

![设置](docs/screen-shot/zh-setting.png)


---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、TypeScript、Vite 5、Tailwind CSS、react-i18next |
| 桌面 | Tauri 2（Rust） |
| 典型依赖 | serde、git2、ureq、walkdir 等 |

开发与构建需安装 **Node.js**、**Rust**；在 macOS 上编译部分原生依赖时可能需要 **OpenSSL**（见下文）。

---

## 快速开始

### 环境要求

- **Node.js 18+**（`npm` 或 `pnpm`，与仓库锁文件一致即可）
- **Rust**（`rustup` 安装 stable）
- **macOS**：若遇 OpenSSL 相关报错，可用 Homebrew：
  ```bash
  brew install openssl@3
  export OPENSSL_DIR=$(brew --prefix openssl@3)
  export PKG_CONFIG_PATH=$(brew --prefix openssl@3)/lib/pkgconfig
  ```

### 克隆与安装

```bash
git clone <仓库地址>
cd skills-managers
npm install
```

### 可选：启用统计与监控（Aptabase + Sentry）

```bash
cp .env.example .env
```

按需填写以下变量：

- `APTABASE_APP_KEY`：事件统计（前端 `trackEvent` + Rust 生命周期事件）
- `VITE_SENTRY_DSN`：前端 React 错误上报
- `SENTRY_DSN`：Rust 侧 panic / error 上报
- `VITE_ENABLE_TELEMETRY=false`：可一键关闭前端 telemetry

### 开发调试

```bash
npm run tauri:dev
```

将启动 Vite（默认 `http://localhost:5173`）并打开桌面窗口；前端热更新，后端修改后需按 Tauri  usual 流程重新编译。

在**纯浏览器**中打开前端时，部分能力会使用 Mock 数据，完整功能请在 Tauri 窗口中使用。

---

## 构建发布

```bash
# Windows x64
npm run tauri:build

# macOS（按需指定 target，详见 Tauri 文档）
npm run tauri:build -- --target aarch64-apple-darwin
npm run tauri:build -- --target x86_64-apple-darwin
```

产物位于 `src-tauri/target/release/` 及 `src-tauri/target/release/bundle/`（安装包视平台而定）。

仅改 Rust 时可加快迭代：

```bash
cargo build --manifest-path=src-tauri/Cargo.toml
```

---

## 配置与数据位置（摘要）

- 应用配置：`~/.skills-manager/config.json`（技能启用状态、Agent、语言等）
- 中央技能目录：`~/.skills-manager/skills/`
- GitHub 备份相关配置由应用写入上述配置体系（具体字段以当前版本为准）

技能元数据来自各目录下的 **`SKILL.md`**（建议含 YAML frontmatter：`name`、`description` 等）。

---

## 常见问题

| 现象 | 处理方向 |
|------|----------|
| 图标格式报错 | 使用 `npx @tauri-apps/cli icon <源图>` 生成符合要求的图标集 |
| 5173 端口占用 | 结束占用进程或修改 Vite 端口配置 |
| macOS OpenSSL | 设置上文 `OPENSSL_DIR` / `PKG_CONFIG_PATH` |
| 列表里没有技能 | 确认本机已安装对应 Agent、技能路径存在且含 `SKILL.md`，在界面中执行重新扫描 |

更细的开发者说明见仓库根目录 **`CLAUDE.md`**；历史设计文档见 **`docs/`**（部分为阶段性记录，以代码为准）。

---

## 项目结构（简）

```
skills-manager/
├── app/                 # React 前端（Vite）
├── src-tauri/           # Tauri + Rust 后端
├── docs/                # 文档与资源（如 docs/assets/logo.png）
├── LICENSE
├── README.md
└── README.en.md         # 英文说明
```

---

## 参与贡献

欢迎通过 [GitHub Issues](https://github.com/cchao123/skills-managers/issues) 反馈与讨论，也欢迎 Pull Request：功能改进、文档、国际化、Bug 修复等。

1. Fork 本仓库  
2. 新建分支：`git checkout -b feature/your-feature`  
3. 提交修改并推送  
4. 发起 Pull Request  

提交前建议在本地执行 **`npm run build`**（含 `tsc`）与 **`cargo build`**，减少 CI 失败。

---

## 开源协议

本项目以 **MIT License** 发布，详见仓库内 [`LICENSE`](LICENSE)。

英文说明见 **[`README.en.md`](README.en.md)**。

---

## 致谢 · Acknowledgments

- [Tauri](https://tauri.app/) · [Material Symbols](https://fonts.google.com/icons) · [Claude Code](https://claude.ai/code)
