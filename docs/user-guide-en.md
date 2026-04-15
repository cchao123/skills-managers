# Skills Manager User Guide

## Introduction

Skills Manager is a desktop application (macOS / Windows) for managing AI coding agent skills (plugins). It supports popular agents including Claude Code, Cursor, Codex, OpenClaw, and OpenCode.

Built with Tauri 2 + React, the app is lightweight, fast, and supports both Chinese and English interfaces with dark mode.

---

## Quick Start

1. Download the latest version from [GitHub Releases](https://github.com/cchao123/skills-managers/releases)
2. Install and launch the application
3. The app automatically scans local agent directories and detects installed skills

---

## Feature Overview

The app consists of three pages:

| Page | Description |
|------|-------------|
| **Installed Skills** | View, enable/disable, import, and delete skills |
| **GitHub Backup** | Sync skills to/from a GitHub repository |
| **Settings** | Language, theme, agent management, and about |

---

## 1. Installed Skills (Dashboard)

### 1.1 View Modes

Toggle between two view modes in the top-right corner of the page header:

- **Flat View**: All skills from all sources are displayed in a deduplicated two-column masonry layout. Duplicate skills are merged automatically (priority: global > claude > cursor).
- **By-Source View**: Skills are grouped by source. Use the source filter tabs to switch between different sources.

### 1.2 Search and Filtering

- **Search bar**: Fuzzy search across skill names and descriptions
- **Stats bar** (flat view): Shows counts for "All / Enabled / Disabled" — click to filter
- **Source tabs** (by-source view): Switch between skill sources

### 1.3 Skill Card Actions

Each skill card includes:

- **Master toggle**: Globally enable/disable the skill with cascading logic
  - Turning OFF: Backs up per-agent states, then disables all agents
  - Turning ON: Restores previously backed-up per-agent states
- **Expandable panel**: Expand to manage per-agent enable/disable toggles individually
- **Detail button**: Opens the skill detail modal

### 1.4 Skill Detail Modal

Contains the following sections:

- **File tree + content preview** (resizable split pane)
  - Left: Collapsible file directory tree
  - Right: File content viewer with monospace rendering
- **Agent enable status**: Individual toggle for each agent
- **Delete button** (only for global source skills)

### 1.5 Drag-and-Drop Import

Drag folders containing `SKILL.md` directly into the app window:

1. A "Drop to install" overlay appears when dragging
2. Release to start importing — a progress indicator is shown
3. Success/error notifications appear when complete
4. Supports dragging multiple folders at once

### 1.6 Open Folder

Click the folder icon in the search bar to navigate to **Settings > Agents** page for managing agent directories.

---

## 2. GitHub Backup

### 2.1 Configuration Steps

1. **Create a GitHub repository**: Create a new empty repository on GitHub
2. **Generate a Personal Access Token**: Go to [GitHub Token Settings](https://github.com/settings/personal-access-tokens) and generate a token with `repo` permissions
3. **Fill in the configuration form**:
   - **Owner / Repository name**: e.g., `cchao123/my-skills`
   - **Branch**: Defaults to `main`
   - **Token**: Paste the token you generated
4. **Test connection**: Click "Test Connection" to verify your configuration

### 2.2 Sync to GitHub

Click "Sync Now" to push local skills to the GitHub repository:

- **Normal sync**: Only pushes changed files
- **Overwrite remote**: Click the dropdown arrow and check "Overwrite remote with local version" to force-push local content. A confirmation dialog will appear.

### 2.3 Restore from GitHub

Click "Restore from GitHub" to pull remote skills to local:

- **Normal restore**: Remote files overwrite local同名 files, local-only files are preserved
- **Overwrite local**: Click the dropdown arrow and check "Overwrite local with remote version" to make local identical to remote. Local-only files will be deleted. A confirmation dialog will appear.

### 2.4 Other Features

- **Star button**: Star the Skills Manager project from the top-right corner
- **Open local directory**: Opens `~/.skills-manager` in the system file manager
- **Status badge**: When connected, a clickable GitHub repository link is displayed

### 2.5 Share with Others

The "Share with Others" section at the bottom provides commands for others to install your skills via Claude Code:

1. Register Marketplace:
   ```
   /plugin marketplace add owner/repo
   ```
2. Install a skill:
   ```
   /plugin install <skill-name>@owner/repo
   ```

---

## 3. Settings

### 3.1 General

#### Language

Switch between Chinese and English. The system tray menu language updates automatically.

#### Appearance

Three theme options:

- **Light**: Always use light theme
- **Dark**: Always use dark theme
- **System**: Automatically match the system dark mode setting

### 3.2 Agents

Displays all supported AI coding assistants:

| Agent | Name | Config Directory |
|-------|------|-----------------|
| Claude Code | Claude | ~/.claude |
| Cursor | Cursor | ~/.cursor |
| Codex | Codex | ~/.codex |
| OpenClaw | OpenClaw | ~/.openclaw |
| OpenCode | OpenCode | ~/.opencode |

- **Installed** agents: Green badge, click to open their config directory
- **Not installed** agents: Gray badge, not clickable

At the bottom of the page, a separate card for Skills Manager itself (octopus icon) opens the `~/.skills-manager` directory.

### 3.3 About

Displays app version information and relevant links.

---

## 4. Skill File Format

Each skill is a folder that must contain a `SKILL.md` file. `SKILL.md` uses YAML frontmatter format:

```markdown
---
name: my-skill
description: A brief description of the skill
---

# My Skill

The actual content of the skill...
```

### Skill Storage Paths

| Source | Path |
|--------|------|
| Skills Manager (global) | ~/.skills-manager/skills/ |
| Claude Code plugin cache | ~/.claude/plugins/cache/ |
| Claude Code custom | ~/.claude/skills/ |
| Cursor | ~/.cursor/skills/ |

---

## 5. FAQ

### GitHub Connection Failed

- Verify the token has `repo` permissions
- Confirm the owner and repository name are spelled correctly
- Confirm the branch name is correct (default: `main`)
- Check your network connection

### Sync Conflicts

By default, the remote version takes precedence during sync. To use local as the source of truth, check "Overwrite remote with local version".

### Agent Not Detected

The app detects agents by checking if directories like `~/.claude`, `~/.cursor` exist. If an installed agent is not detected, verify the installation path is correct.

### Skill Import Failed

Ensure the folder contains a `SKILL.md` file at the root level with valid YAML frontmatter.
