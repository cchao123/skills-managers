# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Skills Manager is a desktop application for managing Codex skills and plugins. It's built with **Tauri 2** (Rust backend) and **React + TypeScript** (Vite frontend), targeting macOS and Windows.

The application scans Codex's plugin directories, displays skills in a UI, and enables/disables them by modifying `~/.Codex/settings.json`. It also supports cloning GitHub repositories containing custom skills.

## Development Commands

### Start Development Server
```bash
npm run tauri:dev
```
This starts:
- Vite dev server on http://localhost:5173 (frontend with hot reload)
- Tauri app window
- Rust cargo watch for backend changes

**Note**: Requires Rust toolchain and OpenSSL. On macOS with Homebrew:
```bash
export OPENSSL_DIR=$(brew --prefix openssl@3)
export PKG_CONFIG_PATH=$(brew --prefix openssl@3)/lib/pkgconfig
```

### Build Production Bundle
```bash
# macOS
npm run tauri:build --target universal-apple-darwin

# Windows
npm run tauri:build --target x86_64-pc-windows-msvc
```
Output: `src-tauri/target/release/bundle/`

### Build Rust Only (faster for backend changes)
```bash
cargo build --manifest-path=src-tauri/Cargo.toml
```

## Architecture

### Tauri IPC Pattern
The app uses Tauri's command system for Rust↔JavaScript communication:

**Rust (src-tauri/src/commands/)**: Define functions with `#[tauri::command]`
**Frontend (app/src/api/tauri.ts)**: Call via `invoke('command_name', { args })`

All commands are registered in `src-tauri/src/main.rs` using `tauri::generate_handler!`.

### Core Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **SkillScanner** | scanner.rs | Scans `~/.Codex/plugins/cache/` and `~/.Codex/skills-manager/` for skills, parses SKILL.md frontmatter |
| **SettingsManager** | settings.rs | Reads/writes `~/.Codex/settings.json`, manages `enabledPlugins` field |
| **GitHubIntegrator** | github.rs | Git operations (clone/pull) using `git2` crate |
| **Commands** | commands/*.rs | Tauri command handlers (skills.rs, github.rs) |

### Codex Integration

The app integrates with Codex by:

1. **Scanning**: Reads `~/.Codex/plugins/cache/[marketplace]/[plugin]/[version]/skills/` for `SKILL.md` files
2. **Enabling/Disabling**: Modifies `~/.Codex/settings.json`:
   ```json
   {
     "enabledPlugins": {
       "superpowers@Codex-plugins-official": true
     }
   }
   ```
3. **GitHub Skills**: Clones repos to `~/.Codex/skills-manager/[repo-name]/skills/`

### Skill File Format

Skills are defined with YAML frontmatter:
```yaml
---
name: skill-name
description: Skill description
---
```

The scanner parses this using regex to extract `name` and `description`. Skills without frontmatter use the directory name as fallback.

### Frontend Structure

- **app/src/App.tsx**: Main app with simple state-based routing (currentPage: 'dashboard' | 'settings')
- **app/src/pages/**: Dashboard.tsx, Settings.tsx (no React Router, just conditional rendering)
- **app/src/api/tauri.ts**: Wrapper around `@tauri-apps/api/tauri` invoke function

### State Management

No external state management library. React's `useState` manages:
- Skills list (fetched via Tauri commands)
- GitHub repos (fetched via Tauri commands)
- UI state (search term, filter, add form visibility)

## Important File Locations

| Purpose | Path |
|---------|------|
| Codex settings | `~/.Codex/settings.json` |
| Plugin cache | `~/.Codex/plugins/cache/[marketplace]/[plugin]/[version]/` |
| GitHub skills | `~/.Codex/skills-manager/[repo-name]/skills/` |
| App config | `~/.skills-manager/config.json`, `~/.skills-manager/github-config.json` |
| Tauri config | `src-tauri/tauri.conf.json` |
| Rust entry | `src-tauri/src/main.rs` |
| Frontend entry | `app/src/main.tsx` |

## Adding New Tauri Commands

1. Define function in `src-tauri/src/commands/` with `#[tauri::command]`
2. Register in `src-tauri/src/main.rs`: `skills_commands::your_function_name`
3. Add to invoke handler: `your_commands::your_function_name`
4. Add frontend wrapper in `app/src/api/tauri.ts`

## Dependencies

Key Rust crates:
- **tauri 2**: Desktop framework
- **git2**: Git operations
- **serde**: Serialization
- **anyhow**: Error handling

Key npm packages:
- **@tauri-apps/api 2**: Tauri frontend bindings
- **react 18**: UI framework
- **vite 5**: Build tool
- **tailwindcss**: Styling

## Common Issues

### "Icon not RGBA" Error
Tauri requires RGBA format PNG icons. Generate using:
```bash
npx @tauri-apps/cli icon <input.svg>
```

### OpenSSL Errors
On macOS, ensure OpenSSL is installed via Homebrew and env vars are set.

### Port 5173 Already in Use
Kill the process: `lsof -ti:5173 | xargs kill -9`
