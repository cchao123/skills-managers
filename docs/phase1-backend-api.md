# Phase 1 Backend API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-03-29
**Status:** Complete ✅

---

## Overview

This document describes the backend API for Skills Manager Phase 1. The API is implemented as Tauri commands that bridge the Rust backend with the TypeScript frontend. All commands are asynchronous and return `Result<T, String>` for error handling.

**Base Location:** `src-tauri/src/commands/`

---

## Architecture

### Application State

The application uses a shared state pattern with `AppState`:

```rust
pub struct AppState {
    pub settings_manager: Mutex<AppSettingsManager>,
}
```

- **Thread Safety:** Uses `std::sync::Mutex` for safe concurrent access
- **Lifecycle:** Initialized in `tauri::setup()` and available to all commands via `tauri::State`
- **Scope:** Application-wide singleton

---

## API Commands

### Skills Management Commands

**Module:** `src-tauri/src/commands/skills.rs`

#### 1. list_skills

List all available skills in the skills directory.

**Signature:**
```rust
pub async fn list_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String>
```

**Returns:** `Vec<SkillMetadata>` - Array of skill metadata

**Example Response:**
```json
[
  {
    "id": "superpowers:subagent-driven-development",
    "name": "subagent-driven-development",
    "description": "Execute plans by dispatching fresh subagents",
    "enabled": false,
    "agent_enabled": {},
    "source_path": "~/.claude/plugins/cache/.../skills/",
    "version": "5.0.6"
  }
]
```

**Error Cases:**
- Failed to acquire settings lock
- Skills directory not accessible
- Scan errors (invalid YAML, missing metadata)

---

#### 2. enable_skill

Enable a skill for one or all agents.

**Signature:**
```rust
pub async fn enable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**Parameters:**
- `skill_id` (required): Unique identifier of the skill
- `agent` (optional): Name of specific agent, or `None` for all agents

**Behavior:**
- If `agent` is `None`: Enables skill for all enabled agents
- If `agent` is `Some(name)`: Enables skill only for that agent
- Creates file links using configured strategy (symlink with copy fallback)
- Updates skill's `agent_enabled` map

**Error Cases:**
- Skill not found
- Agent not found
- Link creation failed
- Permission denied

---

#### 3. disable_skill

Disable a skill for one or all agents.

**Signature:**
```rust
pub async fn disable_skill(
    skill_id: String,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**Parameters:**
- `skill_id` (required): Unique identifier of the skill
- `agent` (optional): Name of specific agent, or `None` for all agents

**Behavior:**
- If `agent` is `None`: Disables skill for all agents
- If `agent` is `Some(name)`: Disables skill only for that agent
- Removes file links from agent directories
- Updates skill's `agent_enabled` map

**Error Cases:**
- Skill not found
- Agent not found
- Link removal failed
- Permission denied

---

#### 4. get_skill_content

Read and return the content of a skill's SKILL.md file.

**Signature:**
```rust
pub async fn get_skill_content(
    skill_id: String,
    state: State<'_, AppState>,
) -> Result<String, String>
```

**Parameters:**
- `skill_id` (required): Unique identifier of the skill

**Returns:** `String` - Full content of SKILL.md file

**Error Cases:**
- Skill not found
- SKILL.md file not found
- File read permission denied

---

#### 5. rescan_skills

Rescan the skills directory and return updated list.

**Signature:**
```rust
pub async fn rescan_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillMetadata>, String>
```

**Returns:** `Vec<SkillMetadata>` - Freshly scanned array of skills

**Behavior:**
- Forces a rescan of the skills directory
- Updates in-memory skill cache
- Useful after manual file changes

**Error Cases:**
- Scan errors (invalid YAML, missing metadata)
- Directory access errors

---

### Settings Management Commands

**Module:** `src-tauri/src/commands/settings.rs`

#### 6. get_agents

Get list of all configured agents.

**Signature:**
```rust
pub async fn get_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConfig>, String>
```

**Returns:** `Vec<AgentConfig>` - Array of agent configurations

**Example Response:**
```json
[
  {
    "name": "claude-code",
    "display_name": "Claude Code",
    "path": "~/.claude",
    "skills_path": "skills/plugins",
    "enabled": true,
    "detected": true
  },
  {
    "name": "cursor",
    "display_name": "Cursor",
    "path": "~/.cursor",
    "skills_path": "skills",
    "enabled": true,
    "detected": false
  }
]
```

---

#### 7. add_agent

Add a new agent configuration.

**Signature:**
```rust
pub async fn add_agent(
    agent: AgentConfig,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**Parameters:**
- `agent` (required): Complete agent configuration object

**Error Cases:**
- Agent with same name already exists
- Invalid configuration
- Save failed

---

#### 8. remove_agent

Remove an agent configuration.

**Signature:**
```rust
pub async fn remove_agent(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**Parameters:**
- `name` (required): Name of agent to remove

**Error Cases:**
- Agent not found
- Save failed

---

#### 9. get_config

Get the full application configuration.

**Signature:**
```rust
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<AppConfig, String>
```

**Returns:** `AppConfig` - Complete application configuration

**Example Response:**
```json
{
  "linking_strategy": "Symlink",
  "agents": [...]
}
```

---

#### 10. set_linking_strategy

Set the file linking strategy for skill operations.

**Signature:**
```rust
pub async fn set_linking_strategy(
    strategy: LinkStrategy,
    state: State<'_, AppState>,
) -> Result<(), String>
```

**Parameters:**
- `strategy` (required): Link strategy to use

**Valid Values:**
- `"Symlink"`: Create symbolic links (default)
- `"Copy"`: Copy files (fallback on failure)

**Error Cases:**
- Invalid strategy
- Save failed

---

#### 11. open_skills_manager_folder

Open the Skills Manager folder in the system file manager.

**Signature:**
```rust
pub async fn open_skills_manager_folder() -> Result<(), String>
```

**Behavior:**
- Creates directory if it doesn't exist
- Opens platform-specific file manager:
  - macOS: `open`
  - Windows: `explorer`
  - Linux: `xdg-open`

**Error Cases:**
- Directory creation failed
- Failed to open file manager

---

#### 12. detect_agents

Detect which agents are installed on the system.

**Signature:**
```rust
pub async fn detect_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentConfig>, String>
```

**Returns:** `Vec<AgentConfig>` - Updated array of agents with `detected` field

**Behavior:**
- Checks if each agent's directory exists
- Updates `detected` boolean field
- Saves updated configuration
- Returns updated agent list

**Example Response:**
```json
[
  {
    "name": "claude-code",
    "display_name": "Claude Code",
    "path": "~/.claude",
    "skills_path": "skills/plugins",
    "enabled": true,
    "detected": true
  }
]
```

---

## Data Models

### SkillMetadata

```rust
pub struct SkillMetadata {
    pub id: String,              // Unique identifier (e.g., "superpowers:subagent-driven-development")
    pub name: String,            // Skill name
    pub description: String,     // Skill description
    pub enabled: bool,           // Globally enabled flag
    pub agent_enabled: HashMap<String, bool>,  // Per-agent enablement
    pub source_path: PathBuf,    // Path to skill directory
    pub version: Option<String>, // Skill version
}
```

### AgentConfig

```rust
pub struct AgentConfig {
    pub name: String,            // Unique identifier (e.g., "claude-code")
    pub display_name: String,    // Human-readable name
    pub path: String,            // Base path (e.g., "~/.claude")
    pub skills_path: String,     // Relative skills path (e.g., "skills/plugins")
    pub enabled: bool,           // Whether agent is active
    pub detected: bool,          // Whether agent is installed
}
```

### AppConfig

```rust
pub struct AppConfig {
    pub linking_strategy: LinkStrategy,  // File linking strategy
    pub agents: Vec<AgentConfig>,        // Configured agents
}
```

### LinkStrategy

```rust
pub enum LinkStrategy {
    Symlink,  // Create symbolic links
    Copy,     // Copy files
}
```

---

## Error Handling

All commands return `Result<T, String>` where the error string is a human-readable message.

**Error Format:**
```json
{
  "error": "Failed to scan skills: Directory not found"
}
```

**Common Error Types:**
- **Scanner Errors:** Invalid YAML, missing metadata, directory access
- **Linker Errors:** Permission denied, invalid path, disk full
- **Settings Errors:** Config not found, save failed, agent already exists
- **IO Errors:** File read/write failures

---

## Logging

All commands use the `log` crate with `env_logger` backend:

**Log Levels:**
- `info`: Normal operations (command start, success counts)
- `warn`: Partial failures (some agents succeed, some fail)
- `error`: Complete failures (command aborts)

**Enabling Debug Logging:**
```bash
RUST_LOG=debug npm run tauri:dev
```

**Example Log Output:**
```
[INFO] Listing skills...
[INFO] Scanning skills directory: "/Users/user/.skills-manager/skills"
[INFO] Found 15 skills
[WARN] Failed to link to agent cursor: Permission denied
[INFO] Successfully enabled skill for 2 agents
```

---

## Configuration File

**Location:** `~/.skills-manager/config.json`

**Default Configuration:**
```json
{
  "linking_strategy": "Symlink",
  "agents": [
    {
      "name": "claude-code",
      "display_name": "Claude Code",
      "path": "~/.claude",
      "skills_path": "skills/plugins",
      "enabled": true,
      "detected": false
    },
    {
      "name": "cursor",
      "display_name": "Cursor",
      "path": "~/.cursor",
      "skills_path": "skills",
      "enabled": true,
      "detected": false
    },
    {
      "name": "windsurf",
      "display_name": "Windsurf",
      "path": "~/.windsurf",
      "skills_path": "skills",
      "enabled": true,
      "detected": false
    }
  ]
}
```

---

## Thread Safety

All commands use `std::sync::Mutex<AppSettingsManager>` for thread-safe access:

**Lock Acquisition:**
```rust
let settings = state.settings_manager.lock()
    .map_err(|e| format!("Failed to acquire lock: {}", e))?;
```

**Best Practices:**
- Keep lock duration short
- Release lock before I/O operations when possible
- Avoid nested lock acquisitions

---

## Platform Support

### macOS
- Symbolic links: Full support
- File manager: `open` command
- Permissions: Standard file permissions

### Windows
- Symbolic links: Requires Developer Mode or Administrator privileges
- File manager: `explorer` command
- Permissions: May require elevation for symlinks

### Linux
- Symbolic links: Full support
- File manager: `xdg-open` command
- Permissions: Standard file permissions

---

## Testing

All modules have comprehensive unit tests:

**Run Tests:**
```bash
cargo test --manifest-path=src-tauri/Cargo.toml
```

**Test Coverage:**
- Models: 3 tests (serialization)
- Scanner: 4 tests (YAML parsing, directory scanning)
- Linker: 4 tests (symlink creation, verification, fallback)
- Settings: 4 tests (CRUD operations, default config)
- **Total:** 15 tests, 100% passing

---

## Future Enhancements (Phase 2+)

- Use `SkillsManagerError` in command signatures instead of `String`
- Add command for skill state persistence
- Add batch operations for multiple skills
- Add skill validation commands
- Add git integration for GitHub skills
- Add skill update checking
- Add skill dependency management

---

## API Versioning

**Current Version:** 1.0.0

**Breaking Changes:** None in Phase 1

**Backward Compatibility:** All legacy code preserved with `Legacy*` prefixes

---

**Document Version:** 1.0.0
**Last Updated:** 2025-03-29
**Status:** Complete ✅
