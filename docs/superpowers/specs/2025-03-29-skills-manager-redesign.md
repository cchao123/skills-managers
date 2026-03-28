# Skills Manager - Multi-Agent Skill Management System Design

**Date:** 2025-03-29
**Author:** Design discussion with user
**Status:** Approved

## 1. Overview

Skills Manager is a desktop application for managing AI coding assistant skills across multiple agents (Claude Code, Cursor, Windsurf, etc.). It provides a centralized skill repository with intelligent linking to agent directories, GitHub sync capabilities, and a marketplace for discovering new skills.

**Key Goals:**
- Centralized skill storage in `~/.skills-manager/skills/`
- Multi-agent support with per-agent enable/disable control
- GitHub sync with conflict detection and resolution
- Compatible with Claude Code's `/plugin install` command
- Cross-platform support (macOS, Windows)

## 2. System Architecture

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    Skills Manager App                    │
│                     (Tauri + React)                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Marketplace  │  │  Dashboard   │  │ GitHubBackup │  │
│  │              │  │              │  │              │  │
│  │ - Browse     │  │ - List       │  │ - Sync       │  │
│  │ - Install    │  │ - Enable/Dis │  │ - Conflicts  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│              Core Modules (Rust Backend)                 │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │  Scanner   │ │  Linker  │ │  Syncer  │ │ Settings│  │
│  │            │ │          │ │          │ │         │  │
│  │- Scan dirs │ │- Link    │ │- Git ops │ │- Config │  │
│  │- Parse MD  │ │- Unlink  │ │- Detect  │ │- Persist│  │
│  │- Detect    │ │- Update  │ │- Resolve │ │- Load   │  │
│  └────────────┘ └──────────┘ └──────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   ~/.skills-manager/                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐      │
│  │  skills/   │  │  config/   │  │   cache/     │      │
│  │            │  │            │  │              │      │
│  │skill-name/ │  │config.json │  │temp/         │      │
│  │  SKILL.md  │  │agents.json │  │repos/        │      │
│  └────────────┘  └────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │.claude  │       │.cursor  │       │.windsurf│
   │/skills  │       │/skills  │       │/skills  │
   └─────────┘       └─────────┘       └─────────┘
   (symlinks/copy)    (symlinks/copy)    (symlinks/copy)
```

### 2.2 Data Flow

**Installation Flow:**
```
Marketplace → Select Skill → Choose Agents → Download to
                                             ~/.skills-manager/
                                                   │
                                                   ▼
                                          LinkManager
                                                   │
                        ┌──────────────────────────┼──────────────┐
                        ▼                          ▼              ▼
                   ~/.claude/               ~/.cursor/      ~/.windsurf/
                   skills/                  skills/         skills/
```

**Sync Flow:**
```
User Request → Detect Conflicts → Resolve → Generate Plugin
                                                   Format
                                                     │
                                                     ▼
                                              Git Commit/Push
                                                     │
                                                     ▼
                                          GitHub Repository
                                          (installable via
                                           /plugin install)
```

## 3. Data Models

### 3.1 Skill Metadata

```typescript
interface SkillMetadata {
  id: string;                    // Unique identifier
  name: string;                  // Skill name from frontmatter
  description: string;           // Skill description
  category: string;              // e.g., "Web", "Data", "Git"
  author?: string;               // Optional author
  version?: string;              // Optional version
  repository?: string;           // GitHub source if installed from repo
  enabled: boolean;              // Global enabled state
  agent_enabled: {               // Per-agent enabled states
    [agentName: string]: boolean // e.g., { "claude-code": true, "cursor": false }
  };
  installed_at: string;          // ISO timestamp
  last_updated: string;          // ISO timestamp
}
```

### 3.2 Agent Configuration

```typescript
interface AgentConfig {
  name: string;                  // Internal identifier
  display_name: string;          // Display name in UI
  path: string;                  // Base path to agent directory
  skills_path: string;           // Relative path to skills folder
  enabled: boolean;              // Whether this agent is active
  detected: boolean;             // Auto-detected on system
}
```

**Default Presets:**
```typescript
const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: "claude-code",
    display_name: "Claude Code",
    path: "~/.claude",
    skills_path: "skills/plugins",
    enabled: true,
    detected: false
  },
  {
    name: "cursor",
    display_name: "Cursor",
    path: "~/.cursor",
    skills_path: "skills",
    enabled: true,
    detected: false
  },
  {
    name: "windsurf",
    display_name: "Windsurf",
    path: "~/.windsurf",
    skills_path: "skills",
    enabled: true,
    detected: false
  }
];
```

### 3.3 GitHub Configuration

```typescript
interface GitHubConfig {
  owner: string;                 // Repository owner
  repo: string;                  // Repository name
  branch: string;                // Branch name (default: main)
  token?: string;                // Optional personal access token
  sync_mode: 'auto' | 'manual';  // Auto-sync on skill changes
  conflict_resolution: 'local' | 'remote' | 'ask';  // Conflict strategy
  last_sync?: string;            // ISO timestamp of last sync
}
```

### 3.4 Conflict Item

```typescript
interface ConflictItem {
  skill_id: string;
  file_path: string;             // Relative path within skill
  local_hash: string;            // Hash of local version
  remote_hash: string;           // Hash of remote version
  local_modified: string;        // ISO timestamp
  remote_modified: string;       // ISO timestamp
}
```

## 4. Core Modules

### 4.1 Scanner Module (scanner.rs)

**Responsibilities:**
- Scan `~/.skills-manager/skills/` for installed skills
- Parse `SKILL.md` YAML frontmatter
- Detect available agents on the system
- Return skill and agent lists

**Key Functions:**
```rust
pub struct Scanner;

impl Scanner {
    pub fn scan_skills(base_path: &Path) -> Result<Vec<SkillMetadata>>;
    pub fn parse_skill_md(md_path: &Path) -> Result<SkillMetadata>;
    pub fn detect_agents() -> Result<Vec<AgentConfig>>;
    pub fn verify_agent_path(agent: &AgentConfig) -> bool;
}
```

**SKILL.md Format:**
```markdown
---
name: web-scraper
description: Efficient web data extraction tool
category: Web
author: username
version: 1.0.0
---

# Web Scraper

Detailed skill description...
```

### 4.2 Link Manager Module (linker.rs)

**Responsibilities:**
- Create symlinks or copies from central storage to agent directories
- Unlink skills from agents
- Update links when skills change
- Handle per-agent enable/disable

**Key Functions:**
```rust
pub struct LinkManager {
    strategy: LinkStrategy,
}

pub enum LinkStrategy {
    Symlink,   // Default: use symbolic links
    Copy,      // Fallback: copy files
}

impl LinkManager {
    pub fn link_skill(
        &self,
        skill: &SkillMetadata,
        agents: &[AgentConfig]
    ) -> Result<HashMap<String, PathBuf>>;

    pub fn unlink_skill(
        &self,
        skill: &SkillMetadata,
        agents: &[AgentConfig]
    ) -> Result<()>;

    pub fn update_agent_status(
        &self,
        skill: &SkillMetadata,
        agent: &str,
        enabled: bool
    ) -> Result<()>;
}
```

**Cross-Platform Behavior:**
- **Unix (macOS/Linux):** Use `std::os::unix::fs::symlink`
- **Windows:** Try `std::os::windows::fs::symlink_file`, fall back to copy on error
- Configuration stored in `~/.skills-manager/config.json`

### 4.3 Sync Manager Module (syncer.rs)

**Responsibilities:**
- Clone/pull GitHub repository
- Detect conflicts between local and remote
- Resolve conflicts based on user preference
- Generate Claude Code plugin format
- Commit and push changes

**Key Functions:**
```rust
pub struct SyncManager {
    github_config: GitHubConfig,
}

impl SyncManager {
    pub fn sync_to_github(&self) -> Result<SyncResult>;
    pub fn detect_conflicts(&self) -> Result<Vec<ConflictItem>>;
    pub fn resolve_conflict(
        &self,
        conflict: ConflictItem,
        resolution: Resolution
    ) -> Result<()>;
    pub fn generate_plugin_manifest(&self) -> Result<String>;
    pub fn generate_marketplace_index(&self) -> Result<String>;
}

pub enum Resolution {
    KeepLocal,
    UseRemote,
    ManualMerge,
}

pub struct SyncResult {
    synced: usize,
    conflicts: Vec<ConflictItem>,
    errors: Vec<String>,
}
```

**Repository Structure Generation:**
```
skills-manager/
├── .claude-plugin/
│   └── plugin.json          # Auto-generated
├── skills/                   # All skills
│   ├── skill-name/
│   │   └── SKILL.md
│   └── another-skill/
│       └── SKILL.md
└── marketplace.json          # Auto-generated index
```

### 4.4 Settings Manager Module (settings.rs)

**Responsibilities:**
- Load and save configuration
- Manage agent list
- Persist linking strategy
- Store GitHub credentials (encrypted)

**Key Functions:**
```rust
pub struct SettingsManager {
    config_path: PathBuf,
}

impl SettingsManager {
    pub fn new() -> Result<Self>;
    pub fn load_config(&self) -> Result<AppConfig>;
    pub fn save_config(&self, config: &AppConfig) -> Result<()>;
    pub fn add_agent(&self, agent: AgentConfig) -> Result<()>;
    pub fn remove_agent(&self, name: &str) -> Result<()>;
    pub fn update_linking_strategy(&self, strategy: LinkStrategy) -> Result<()>;
}
```

**Config Structure:**
```json
{
  "linking_strategy": "symlink",
  "agents": [
    {
      "name": "claude-code",
      "display_name": "Claude Code",
      "path": "~/.claude",
      "skills_path": "skills/plugins",
      "enabled": true
    }
  ],
  "github": {
    "owner": "username",
    "repo": "skills-repo",
    "branch": "main",
    "sync_mode": "manual",
    "conflict_resolution": "ask"
  }
}
```

## 5. User Interface Design

### 5.1 Marketplace Page

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Header: Skills Marketplace                          │
│  🔍 Search skills, developers, or categories...      │
│  ───────────────────────────────────────────────────│
│  [All] [Web] [Data] [Git] [Testing] [Documentation]  │
├──────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │  Skill   │ │  Skill   │ │  Skill   │ │  Skill   ││
│  │  Card    │ │  Card    │ │  Card    │ │  Card    ││
│  │          │ │          │ │          │ │          ││
│  │ [Install]│ │ [Install]│ │ [Install]│ │ [Install]││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │  Skill   │ │  Skill   │ │  Skill   │ │  Skill   ││
│  │  Card    │ │  Card    │ │  Card    │ │  Card    ││
│  │          │ │          │ │          │ │          ││
│  │ [Install]│ │ [Install]│ │ [Install]│ │ [Install]││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├──────────────────────────────────────────────────────┤
│  🚀 Can't find what you need?                        │
│     Build custom skills with the SDK                 │
│                                [Start Developing]    │
└──────────────────────────────────────────────────────┘
```

**Skill Card Design:**
```
┌──────────────────────┐
│  🌐                  │
│  Web Scraper         │
│  by @username        │
│  ⭐⭐⭐⭐⭐ (125)     │
│  ───────────────────  │
│  Efficient web data  │
│  extraction tool     │
│  with dynamic render │
│  ───────────────────  │
│  [Install]  [ℹ Info] │
└──────────────────────┘
```

**Interaction Flow:**
1. User clicks "Install" button
2. Agent selection modal appears
3. User checks/unchecks target agents
4. Click "Install" → Download to `~/.skills-manager/skills/`
5. Create links to selected agents
6. Show success notification
7. Auto-navigate to Dashboard

### 5.2 Dashboard Page

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Header: My Skills                                   │
│  🔍 Search...  [All] [Enabled] [Disabled]            │
│  Stats: ●4 Total ●2 Enabled ●2 Disabled              │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────┐ ┌──────────────────────┐│
│  │  🌐 Web Scraper     🔴 │ │  📊 Code Review   🟢 ││
│  │  v2.1.0                │ │  v1.8.3               ││
│  │  ──────────────────────│ │  ─────────────────────││
│  │  高效的网页数据抓取工具 │ │  智能代码审查工具      ││
│  │  ──────────────────────│ │  ─────────────────────││
│  │  2 agents disabled      │ │  All agents enabled    ││
│  │  ▼                     │ │  ▼                    ││
│  │  ☑ Claude Code         │ │  ☑ Claude Code        ││
│  │  ☐ Cursor              │ │  ☑ Cursor             ││
│  │  ☐ Windsurf            │ │  ☑ Windsurf           ││
│  │  ──────────────────────│ │  ─────────────────────││
│  │  [📋] [🗑️]             │ │  [📋] [🗑️]            ││
│  └────────────────────────┘ └──────────────────────┘│
│                                                       │
│  ┌────────────────────────┐ ┌──────────────────────┐│
│  │  💾 SQL Generator   🟢 │ │  🌳 Git Workflow  🔴 ││
│  │  v2.5.0                │ │  v1.3.2               ││
│  │  ──────────────────────│ │  ─────────────────────││
│  │  Natural language to   │ │  Git workflow         ││
│  │  SQL queries           │ │  automation           ││
│  │  ──────────────────────│ │  ─────────────────────││
│  │  All agents enabled     │ │  2 agents disabled     ││
│  └────────────────────────┘ └──────────────────────┘│
└──────────────────────────────────────────────────────┘
```

**Interaction Flows:**

**Toggle Global Enable/Disable:**
1. Click toggle button (🔴/🟢)
2. Update `skill.enabled` state
3. If disabling → unlink from all agents
4. If enabling → show agent selection modal
5. Update links based on selection

**Per-Agent Control:**
1. Click expand arrow (▼) to show agent list
2. Check/uncheck individual agents
3. Real-time link/unlink operation
4. Show loading state during operation

**Quick Actions:**
- Share button: Copy repository URL or skill name
- Delete button: Confirm → remove from all agents → delete files

### 5.3 GitHub Backup Page

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Header: GitHub Sync                                 │
├──────────────────────────────────────────────────────┤
│  ⚙️ Repository Configuration                         │
│  ─────────────────────────────────────────────────── │
│  Repository: [username/skills-repo      ]           │
│  Branch:      [main                     ]           │
│  Token:       [••••••••••••         [Show]]         │
│                                                       │
│  Sync Mode:    ⚪ Auto  ⚪ Manual                    │
│  Conflict:     ⚪ Ask  ⚪ Local  ⚪ Remote           │
│                                                       │
│              [Test Connection]  [Save Changes]       │
├──────────────────────────────────────────────────────┤
│  🔄 Sync Actions                                     │
│  ─────────────────────────────────────────────────── │
│  [Sync Now]                    Last Sync: 2h ago     │
│  Auto-sync: Enabled (triggers on skill changes)      │
├──────────────────────────────────────────────────────┤
│  📊 Sync Status                                      │
│  ─────────────────────────────────────────────────── │
│  ✓ 12 skills successfully synced                     │
│  ⚠️  2 conflicts detected                            │
│  ❌ 1 error occurred                                 │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  ⚠️ Conflict: demo-skill/SKILL.md          │   │
│  │  ─────────────────────────────────────────  │   │
│  │  Local modified:  2025-03-29 10:30:00       │   │
│  │  Remote modified: 2025-03-29 11:45:00       │   │
│  │                                              │   │
│  │  [Keep Local] [Use Remote] [View Diff]      │   │
│  └─────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────┤
│  📂 Repository Structure Preview                      │
│  ─────────────────────────────────────────────────── │
│  username/skills-repo/                               │
│  ├── .claude-plugin/                                 │
│  │   └── plugin.json                                 │
│  ├── skills/                                          │
│  │   ├── web-scraper/                                │
│  │   │   └── SKILL.md                               │
│  │   ├── code-reviewer/                              │
│  │   │   └── SKILL.md                               │
│  │   └── sql-generator/                              │
│  │       └── SKILL.md                               │
│  └── marketplace.json                                 │
│                                                       │
│  This repository is installable via:                 │
│  /plugin install username/skills-repo@github         │
└──────────────────────────────────────────────────────┘
```

**Interaction Flows:**

**Initial Setup:**
1. User enters GitHub repo details
2. Clicks "Test Connection" → validate access
3. Selects sync mode (auto/manual)
4. Selects conflict resolution strategy
5. Clicks "Save Changes"

**Manual Sync:**
1. Click "Sync Now" button
2. Show progress: "Fetching remote changes..."
3. Detect conflicts if any
4. If no conflicts → sync all
5. If conflicts → show resolution UI
6. Show results: "Synced 12 skills, 2 conflicts, 0 errors"

**Conflict Resolution:**
1. Click conflict item to expand
2. View diff (side-by-side comparison)
3. Choose resolution:
   - Keep Local: Use local version
   - Use Remote: Use remote version
   - Manual Merge: Open merge editor
4. Apply resolution
5. Continue sync

### 5.4 Settings Page

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Header: Settings                                    │
├──────────────────────────────────────────────────────┤
│  🔗 Linking Strategy                                 │
│  ─────────────────────────────────────────────────── │
│  ⚪ Symbolic Link (Recommended, Fast)                │
│  ⚪ Copy Files (Slower, More Compatible)             │
│                                                       │
│  Symbolic links use less disk space and update       │
│  instantly when skills change. Copies work on all    │
│  systems but use more space and require manual       │
│  re-linking on updates.                              │
├──────────────────────────────────────────────────────┤
│  🤖 Agent Configuration                              │
│  ─────────────────────────────────────────────────── │
│  ┌────────────────────────────────────────────┐     │
│  │ ☑ Claude Code                              │     │
│  │    Path: ~/.claude/skills/plugins          │     │
│  │    Status: ✓ Detected                      │     │
│  └────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────┐     │
│  │ ☑ Cursor                                   │     │
│  │    Path: ~/.cursor/skills                  │     │
│  │    Status: ✓ Detected                      │     │
│  └────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────┐     │
│  │ ☐ Windsurf                                 │     │
│  │    Path: ~/.windsurf/skills                │     │
│  │    Status: ✗ Not found on system           │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
│  [+ Add Custom Agent]                                │
├──────────────────────────────────────────────────────┤
│  🎨 Appearance                                       │
│  ─────────────────────────────────────────────────── │
│  Theme: ⚪ Light  ⚪ Dark  ⚪ System                  │
├──────────────────────────────────────────────────────┤
│  📁 Storage Locations                                │
│  ─────────────────────────────────────────────────── │
│  Skills Folder:    [~/.skills-manager/skills/  ]    │
│  Config File:      [~/.skills-manager/config.json] │
│                                                       │
│  [Open in Finder]  [Reset to Defaults]              │
└──────────────────────────────────────────────────────┘
```

**Interaction Flows:**

**Linking Strategy:**
1. Select preferred strategy
2. If selecting symlink:
   - Test symlink creation
   - Warn if permissions insufficient
3. If selecting copy:
   - Inform about disk space usage
   - Explain manual re-linking requirement
4. Apply changes → update all existing links

**Agent Configuration:**
1. Toggle checkbox → enable/disable agent
2. Click "+ Add Custom Agent" → open modal
3. Enter: Name, Display Name, Path, Skills Path
4. Validate path exists
5. Save → add to agent list

## 6. Implementation Details

### 6.1 Claude Code Plugin Compatibility

**Required Repository Structure:**
```
username/skills-repo/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin manifest
├── skills/                   # Required: Skill directories
│   ├── skill-name/
│   │   └── SKILL.md         # Skill definition with frontmatter
│   └── another-skill/
│       └── SKILL.md
└── marketplace.json          # Optional: Marketplace index
```

**plugin.json Format:**
```json
{
  "name": "my-skills",
  "version": "1.0.0",
  "description": "我的自定义技能集合"
}
```

**marketplace.json Format:**
```json
{
  "marketplace": {
    "name": "my-skills-marketplace",
    "plugins": [
      {
        "id": "demo-skill",
        "name": "Demo Skill",
        "description": "这是一个示例技能",
        "version": "1.0.0",
        "source": "./skills/demo-skill"
      }
    ]
  }
}
```

**Auto-Generation:**
- `plugin.json`: Generated on first sync, uses repo name
- `marketplace.json`: Generated from all skills in central storage
- Both files are overwritten on each sync (user should not edit manually)

**Installation Syntax:**
```
/plugin install username/skills-repo@github
```

### 6.2 File Linking Implementation

**Symbolic Link Creation:**
```rust
use std::os::unix::fs::symlink;

fn create_symlink(source: &Path, target: &Path) -> Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    // Remove existing link/file if present
    if target.exists() {
        fs::remove_file(target)?;
    }

    // Create symbolic link
    symlink(source, target)?;
    Ok(())
}
```

**Cross-Platform Handling:**
```rust
#[cfg(unix)]
use std::os::unix::fs::symlink;

#[cfg(windows)]
use std::os::windows::fs::symlink_file;

pub fn link_file(source: &Path, target: &Path) -> Result<LinkResult> {
    let result = match std::env::consts::OS {
        "macos" | "linux" => {
            #[cfg(unix)]
            {
                symlink(source, target)
                    .map(|_| LinkResult::Symlink)
                    .or_else(|_| fallback_to_copy(source, target))
            }
            #[cfg(not(unix))]
            { unreachable!() }
        }
        "windows" => {
            #[cfg(windows)]
            {
                symlink_file(source, target)
                    .map(|_| LinkResult::Symlink)
                    .or_else(|_| fallback_to_copy(source, target))
            }
            #[cfg(not(windows))]
            { unreachable!() }
        }
        _ => fallback_to_copy(source, target),
    };

    result
}

fn fallback_to_copy(source: &Path, target: &Path) -> Result<LinkResult> {
    fs::create_dir_all(target.parent().unwrap())?;
    fs::copy(source, target)?;
    Ok(LinkResult::Copy)
}

pub enum LinkResult {
    Symlink,
    Copy,
}
```

**Link Verification:**
```rust
pub fn verify_link(skill_path: &Path, link_path: &Path) -> bool {
    if !link_path.exists() {
        return false;
    }

    // Check if it's a symlink pointing to correct target
    match link_path.read_link() {
        Ok(target) => target == skill_path,
        Err(_) => {
            // Not a symlink, check if files are identical
            same_file::is_same_file(skill_path, link_path).unwrap_or(false)
        }
    }
}
```

### 6.3 Git Operations with git2-rs

**Repository Cloning:**
```rust
use git2::{Repository, CloneOptions};

fn clone_repo(url: &str, path: &Path) -> Result<Repository> {
    let mut opts = CloneOptions::new();
    opts.fetch_options(|fetch| {
        fetch.remote_callbacks(|callbacks| {
            callbacks.credentials(|_url, username, _allowed| {
                git2::Cred::ssh_key_from_agent(
                    username.unwrap(),
                )
            })
        })
    });

    let repo = Repository::clone_opts(url, path, &opts)?;
    Ok(repo)
}
```

**Conflict Detection:**
```rust
pub fn detect_conflicts(local: &Path, remote: &Path) -> Result<Vec<ConflictItem>> {
    let mut conflicts = Vec::new();

    // Walk both directories
    for entry in walkdir::WalkDir::new(local).into_iter().flatten() {
        let local_path = entry.path();
        let rel_path = local_path.strip_prefix(local)?;
        let remote_path = remote.join(rel_path);

        if !remote_path.exists() {
            continue; // Only in local
        }

        // Compare file hashes
        let local_hash = hash_file(local_path)?;
        let remote_hash = hash_file(&remote_path)?;

        if local_hash != remote_hash {
            let metadata = local_path.metadata()?;
            let remote_metadata = remote_path.metadata()?;

            conflicts.push(ConflictItem {
                skill_id: extract_skill_id(rel_path)?,
                file_path: rel_path.to_string_lossy().to_string(),
                local_hash,
                remote_hash,
                local_modified: metadata.modified()?.into(),
                remote_modified: remote_metadata.modified()?.into(),
            });
        }
    }

    Ok(conflicts)
}

fn hash_file(path: &Path) -> Result<String> {
    use std::io::Read;
    use sha2::{Sha256, Digest};

    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)?;
    hasher.update(&buffer);

    Ok(format!("{:x}", hasher.finalize()))
}
```

**Sync with Conflict Resolution:**
```rust
pub fn sync_with_resolution(
    repo: &Repository,
    conflicts: Vec<ConflictItem>,
    resolutions: HashMap<String, Resolution>
) -> Result<SyncResult> {
    let mut synced = 0;
    let mut errors = Vec::new();

    // Apply resolutions
    for conflict in conflicts {
        let resolution = resolutions.get(&conflict.skill_id)
            .unwrap_or(&Resolution::Ask);

        match resolution {
            Resolution::KeepLocal => {
                // Copy local to remote
                copy_file_to_repo(&conflict, repo)?;
                synced += 1;
            }
            Resolution::UseRemote => {
                // Copy remote to local (will be done on pull)
                synced += 1;
            }
            Resolution::ManualMerge => {
                // Open merge tool
                errors.push(format!(
                    "Manual merge required for {}",
                    conflict.skill_id
                ));
            }
        }
    }

    // Commit changes
    if synced > 0 {
        let head = repo.head()?;
        let head_commit = head.peel_to_commit()?;
        let tree = repo.index()?.write_tree()?;

        let sig = repo.signature()?;
        let oid = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Sync skills from Skills Manager",
            &repo.find_tree(tree)?,
            &[&head_commit],
        )?;

        // Push to remote
        let mut remote = repo.find_remote("origin")?;
        remote.push(&[format!("refs/heads/main:refs/heads/main")], None)?;
    }

    Ok(SyncResult { synced, conflicts, errors })
}
```

### 6.4 Cross-Platform Path Handling

**Home Directory Resolution:**
```rust
use dirs::home_dir;

pub fn expand_path(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        home_dir().unwrap().join(&path[2..])
    } else {
        PathBuf::from(path)
    }
}

pub fn get_skills_manager_dir() -> PathBuf {
    home_dir().unwrap().join(".skills-manager")
}

pub fn get_skills_dir() -> PathBuf {
    get_skills_manager_dir().join("skills")
}
```

**Agent Path Detection:**
```rust
pub fn detect_agent_path(agent_name: &str) -> Option<PathBuf> {
    let base_paths = match agent_name {
        "claude-code" => vec![".claude"],
        "cursor" => vec![".cursor", ".cursoruser"],
        "windsurf" => vec![".windsurf"],
        _ => return None,
    };

    let home = home_dir()?;

    for base in base_paths {
        let path = home.join(base);
        if path.exists() {
            return Some(path);
        }
    }

    None
}
```

### 6.5 Error Handling Strategy

**Error Types:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum SkillsManagerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Link creation failed: {0}")]
    LinkFailed(String),

    #[error("Sync conflict: {0}")]
    Conflict(String),
}
```

**User-Facing Error Messages:**
```rust
pub fn error_to_message(error: &SkillsManagerError) -> String {
    match error {
        SkillsManagerError::AgentNotFound(name) => {
            format!(
                "Agent '{}' not found. Please check the agent is installed and the path is correct.",
                name
            )
        }
        SkillsManagerError::LinkFailed(msg) => {
            format!(
                "Failed to create link: {}. Try using 'Copy' mode in Settings.",
                msg
            )
        }
        SkillsManagerError::Conflict(msg) => {
            format!("Sync conflict detected: {}. Please resolve conflicts before continuing.", msg)
        }
        _ => error.to_string(),
    }
}
```

## 7. Testing Strategy

### 7.1 Unit Tests

**Scanner Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_skill_md_valid() {
        let content = r#"
---
name: test-skill
description: Test skill
category: Testing
---

# Test Skill
"#;
        let skill = parse_skill_md(content).unwrap();
        assert_eq!(skill.name, "test-skill");
        assert_eq!(skill.description, "Test skill");
    }

    #[test]
    fn test_parse_skill_md_missing_frontmatter() {
        let content = "# Test Skill";
        assert!(parse_skill_md(content).is_err());
    }
}
```

**LinkManager Tests:**
```rust
#[test]
fn test_create_symlink() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source.txt");
    let target = temp.path().join("target.txt");

    fs::write(&source, b"test content").unwrap();

    let linker = LinkManager::new(LinkStrategy::Symlink);
    linker.link_file(&source, &target).unwrap();

    assert!(target.exists());
    assert_eq!(target.read_link().unwrap(), source);
}

#[test]
fn test_fallback_to_copy() {
    // Test symlink failure fallback
}
```

### 7.2 Integration Tests

**Full Sync Flow:**
```rust
#[test]
fn test_full_sync_flow() {
    // Create temporary git repo
    let temp_repo = tempfile::tempdir().unwrap();
    let repo = init_test_repo(&temp_repo).unwrap();

    // Create test skills
    let skills_dir = temp_repo.path().join("skills");
    create_test_skill(&skills_dir, "skill1").unwrap();

    // Sync
    let syncer = SyncManager::new(test_github_config());
    let result = syncer.sync_to_github().unwrap();

    assert_eq!(result.synced, 1);
    assert!(result.conflicts.is_empty());
}
```

**Multi-Agent Linking:**
```rust
#[test]
fn test_multi_agent_linking() {
    let skills_dir = tempfile::tempdir().unwrap();
    let agent1_dir = tempfile::tempdir().unwrap();
    let agent2_dir = tempfile::tempdir().unwrap();

    let skill = create_test_skill(&skills_dir, "test-skill").unwrap();

    let agents = vec![
        AgentConfig {
            name: "agent1".to_string(),
            path: agent1_dir.path().to_str().unwrap().to_string(),
            skills_path: "skills".to_string(),
            enabled: true,
        },
        AgentConfig {
            name: "agent2".to_string(),
            path: agent2_dir.path().to_str().unwrap().to_string(),
            skills_path: "skills".to_string(),
            enabled: true,
        },
    ];

    let linker = LinkManager::new(LinkStrategy::Symlink);
    linker.link_skill(&skill, &agents).unwrap();

    // Verify links exist in both agents
    assert!(agent1_dir.path().join("skills/test-skill").exists());
    assert!(agent2_dir.path().join("skills/test-skill").exists());
}
```

### 7.3 End-to-End Tests

**Marketplace Install Flow:**
1. Launch app
2. Navigate to Marketplace
3. Find skill
4. Click Install
5. Select agents
6. Confirm installation
7. Verify skill in Dashboard
8. Verify links in agent directories

**GitHub Sync Flow:**
1. Configure GitHub repo
2. Install skills locally
3. Navigate to GitHubBackup
4. Click Sync
5. Resolve conflicts if any
6. Verify repo structure
7. Test `/plugin install` in Claude Code

## 8. Security Considerations

### 8.1 Credential Storage

**GitHub Token:**
- Store in system keychain (macOS Keychain, Windows Credential Manager)
- Never store in plain text
- Use `keyring` crate for cross-platform support

```rust
use keyring::{Entry, Error};

pub fn save_github_token(token: &str) -> Result<(), Error> {
    let entry = Entry::new("skills-manager", "github-token")?;
    entry.set_password(token)
}

pub fn get_github_token() -> Result<String, Error> {
    let entry = Entry::new("skills-manager", "github-token")?;
    entry.get_password()
}
```

### 8.2 File System Operations

**Path Validation:**
```rust
pub fn validate_path(path: &Path) -> Result<()> {
    // Prevent path traversal attacks
    let canonical = path.canonicalize()?;

    let home = home_dir().unwrap();
    let skills_manager = home.join(".skills-manager");

    if !canonical.starts_with(&skills_manager) {
        return Err(SkillsManagerError::InvalidPath(
            "Path must be within ~/.skills-manager".to_string()
        ));
    }

    Ok(())
}
```

### 8.3 Git Operations Security

**SSH Key Handling:**
- Use ssh-agent for authentication
- Never expose private keys
- Support only SSH remotes (not HTTPS with tokens)

## 9. Performance Considerations

### 9.1 Lazy Loading

**Dashboard:**
- Load skill list on demand
- Load agent statuses asynchronously
- Cache results in memory

**Marketplace:**
- Paginate skill cards (50 per page)
- Lazy load images/icons
- Debounce search input

### 9.2 Background Operations

**Sync:**
- Run in background thread
- Show progress indicator
- Allow cancellation

**Scanning:**
- Cache skill metadata
- Only rescan on explicit refresh
- Watch for file system changes (optional)

## 10. Future Enhancements

### 10.1 Planned Features

**Skill Versioning:**
- Track skill versions
- Support multiple versions of same skill
- Update notifications

**Skill Dependencies:**
- Declare dependencies in frontmatter
- Auto-install dependencies
- Dependency graph visualization

**Community Marketplace:**
- Browse skills from community index
- Ratings and reviews
- Skill usage statistics

**CLI Integration:**
- Command-line tool for batch operations
- Scriptable installation
- CI/CD integration

### 10.2 Technical Debt

**Refactoring Targets:**
- Extract UI components to reusable library
- Implement proper state management (Jotai/Zustand)
- Add comprehensive error logging

**Testing Gaps:**
- Increase test coverage to 80%+
- Add visual regression tests
- Performance benchmarking

## 11. Migration Strategy

### 11.1 From Existing App

**Data Migration:**
1. Export existing skills from old app
2. Import to new central storage
3. Detect existing agent installations
4. Offer to migrate to new linking strategy

**Configuration Migration:**
- Migrate settings.json to new format
- Preserve user preferences
- Update agent paths

### 11.2 Zero-Downtime Migration

**Rolling Upgrade:**
1. Install new version alongside old
2. Import data from old version
3. Verify migration success
4. Uninstall old version

## 12. Success Criteria

**Functional Requirements:**
- ✓ Install skills from marketplace
- ✓ Manage skills across multiple agents
- ✓ Sync to GitHub with conflict resolution
- ✓ Compatible with `/plugin install`
- ✓ Cross-platform support (macOS, Windows)

**Non-Functional Requirements:**
- ✓ Response time < 500ms for UI operations
- ✓ Sync completes in < 30s for 100 skills
- ✓ Memory usage < 200MB
- ✓ Test coverage > 70%

**User Experience:**
- ✓ Intuitive interface matching existing design
- ✓ Clear error messages
- ✓ Helpful onboarding flow
- ✓ Comprehensive documentation

## 13. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Scanner module
- LinkManager module
- SettingsManager module
- Basic Tauri commands

### Phase 2: Dashboard UI (Week 3)
- Skill listing
- Agent configuration
- Enable/disable controls
- Per-agent settings

### Phase 3: Marketplace (Week 4)
- Skill browsing
- Search and filter
- Installation flow
- Agent selection modal

### Phase 4: GitHub Sync (Week 5)
- Git integration
- Conflict detection
- Sync UI
- Plugin format generation

### Phase 5: Polish & Testing (Week 6)
- E2E tests
- Performance optimization
- Documentation
- Bug fixes

---

## Appendix A: File Structure

```
skills-managers/
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SkillCard.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── AgentToggle.tsx
│   │   │   └── ConflictResolver.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Marketplace.tsx
│   │   │   ├── GitHubBackup.tsx
│   │   │   └── Settings.tsx
│   │   ├── api/
│   │   │   └── tauri.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── main.tsx
│   └── public/
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── skills.rs
│   │   │   ├── github.rs
│   │   │   └── settings.rs
│   │   ├── scanner.rs
│   │   ├── linker.rs
│   │   ├── syncer.rs
│   │   └── settings.rs
│   └── Cargo.toml
└── docs/
    └── superpowers/
        └── specs/
            └── 2025-03-29-skills-manager-redesign.md
```

## Appendix B: API Reference

### Tauri Commands

**Skills Commands:**
```rust
#[tauri::command]
async fn list_skills() -> Result<Vec<SkillMetadata>, String>

#[tauri::command]
async fn install_skill(
    repo_url: String,
    agents: Vec<String>
) -> Result<SkillMetadata, String>

#[tauri::command]
async fn enable_skill(
    skill_id: String,
    agent: Option<String>
) -> Result<(), String>

#[tauri::command]
async fn disable_skill(
    skill_id: String,
    agent: Option<String>
) -> Result<(), String>

#[tauri::command]
async fn uninstall_skill(skill_id: String) -> Result<(), String>
```

**GitHub Commands:**
```rust
#[tauri::command]
async fn configure_github(
    owner: String,
    repo: String,
    token: Option<String>
) -> Result<(), String>

#[tauri::command]
async fn sync_to_github() -> Result<SyncResult, String>

#[tauri::command]
async fn resolve_conflicts(
    resolutions: HashMap<String, Resolution>
) -> Result<SyncResult, String>
```

**Settings Commands:**
```rust
#[tauri::command]
async fn get_agents() -> Result<Vec<AgentConfig>, String>

#[tauri::command]
async fn add_agent(agent: AgentConfig) -> Result<(), String>

#[tauri::command]
async fn remove_agent(name: String) -> Result<(), String>

#[tauri::command]
async fn set_linking_strategy(
    strategy: LinkStrategy
) -> Result<(), String>
```

---

**End of Design Document**
