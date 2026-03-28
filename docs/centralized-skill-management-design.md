# Centralized Skill Management Design

**Date:** 2026-03-30
**Status:** Design Discussion
**Type:** Architecture Refinement

---

## 1. Overview

Skills Manager currently has a problem: skills installed via Marketplace are scattered across different agent directories, making it hard to manage centrally. This design proposes a centralized skill storage at `~/.skills-manager/skills/` with smart linking to agent-specific directories.

---

## 2. Current Architecture Issues

### 2.1 Fragmented Skill Storage

Skills are stored in multiple locations:
```
~/.claude/skills/              (Claude)
~/.cursor/skills/             (Cursor)
~/.windsurf/skills/           (Windsurf)
~/.opencode/skills/           (OpenCode)
~/.skills-manager/skills/       (Current central storage - limited usage)
```

### 2.2 Inconsistent Dashboard Display

Dashboard scans only `~/.skills-manager/skills/`, so it cannot show skills installed to other agents. If a user installs a skill to Cursor, it won't appear on the dashboard at all.

### 2.3 Complex Enable/Disable Logic

Current implementation requires users to manually manage files across multiple directories, with no unified interface.

---

## 3. Proposed Architecture

### 3.1 Directory Structure

```
~/.skills-manager/
├── skills/                    ← Centralized skill storage (all installed skills)
│   ├── aaa/
│   ├── bbb/
│   └── ccc/
├── config.json
└── [agent-specific symlinks/]
```

**Agent Directories (unchanged):**
```
~/.claude/skills/              (Claude)
~/.cursor/skills/             (Cursor)
~/.windsurf/skills/           (Windsurf)
~/.opencode/skills/           (OpenCode)
```

### 3.2 Skill Installation Flow

When user installs a skill from Marketplace:

1. **Download skill** to `~/.skills-manager/skills/[skill-name]/`
2. **Create structure:**
   ```
   ~/.skills-manager/skills/[skill-name]/
   ├── SKILL.md
   ├── metadata.json
   └── [source files if any]
   ```
3. **Register skill** in central index
4. **Do NOT link to any agent** by default (user chooses which agents to enable)

### 3.3 Agent Enable/Disable Logic

#### Enabling a Skill

When user enables `aaa` for Claude:

```
Input: User enables aaa for Claude
Steps:
1. Check if aaa exists in ~/.skills-manager/skills/aaa/
2. If not found → Error: Skill not installed
3. If exists → Create symlink:
   ~/.claude/skills/aaa → ~/.skills-manager/skills/aaa
4. Update agent_enabled state for Claude
5. Sync with settings file if needed
```

#### Disabling a Skill

When user disables `aaa` for Claude:

```
Input: User disables aaa for Claude
Steps:
1. Check if symlink exists: ~/.claude/skills/aaa
2. If exists → Remove symlink
3. Update agent_enabled state for Claude
```

---

## 4. Dashboard Display Logic

### 4.1 Skill Source Aggregation

Dashboard should aggregate skills from multiple sources:

```
Dashboard Skills = {
  // From central storage
  ...skills from ~/.skills-manager/skills/

  // From agent directories
  ...skills from ~/.claude/skills/      (if Claude enabled)
  ...skills from ~/.cursor/skills/     (if Cursor enabled)
  ...skills from ~/.windsurf/skills/   (if Windsurf enabled)
}
```

### 4.2 Agent-Specific Visibility

For skill `aaa`:

```
Display for Claude user:
├── Claude enabled: YES  → Show aaa with full UI
├── Claude enabled: NO  → Hide aaa completely
└── Claude enabled: YES + Cursor has aaa installed
    → Show aaa with Claude toggle disabled
    (because Claude will manage it via symlink)

Display for Cursor user:
├── Cursor enabled: YES  → Show aaa with full UI
└── Cursor enabled: NO  → Show aaa with gray/disabled state
    (Cursor doesn't have this skill)

Display for other agents:
└── Always hide aaa (they don't have it)
```

### 4.3 UI States

**Skill Card States:**

1. **Fully Enabled** (agent_enabled for ALL enabled agents)
   - Full card visible
   - Global toggle: ON 🔴/🟢
   - All agent toggles: ON
   - Share button: Enabled

2. **Partially Enabled** (enabled for some agents, not others)
   - Full card visible
   - Global toggle: PARTIAL (mixed state)
   - Agent toggles: Mixed (some ON, some OFF)
   - Share button: Enabled
   - Status badge: "2/5 enabled"

3. **Not Enabled for This User** (agent_enabled = false for viewing agent)
   - Card grayed out or hidden
   - Global toggle: OFF 🟢
   - Agent toggles: Disabled (all OFF)
   - Share button: Disabled
   - Status badge: "Not installed"

---

## 5. Backend Implementation Requirements

### 5.1 New Tauri Commands

```rust
/// Centralized skill management commands

#[tauri::command]
pub async fn install_centralized_skill(
    skill_id: String,
    skill_files: HashMap<String, String>,  // name -> content
    target_agents: Vec<String>,  // which agents to link to
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Create directory structure in ~/.skills-manager/skills/
    let skill_dir = SkillsManager::get_central_skills_dir()
        .join(&skill_id);

    fs::create_dir_all(&skill_dir)?;

    // 2. Write SKILL.md
    let skill_md_path = skill_dir.join("SKILL.md");
    fs::write(&skill_md_path, skill_files.get("SKILL.md").unwrap())?;

    // 3. Create metadata.json
    let metadata = CentralSkillMetadata {
        id: skill_id.clone(),
        name: skill_files.get("name").unwrap().to_string(),
        description: skill_files.get("description").unwrap().to_string(),
        version: skill_files.get("version").map(|v| v.to_string()),
        installed_at: Utc::now().to_rfc3339_opts().to_string(),
        source: "marketplace".to_string(),
    };
    fs::write(
        &skill_dir.join("metadata.json"),
        serde_json::to_string_pretty(&metadata)?
    );

    Ok(())
}

#[tauri::command]
pub async fn enable_skill_for_agent(
    skill_id: String,
    agent_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Create symlink from agent directory to central storage
    let agent_config = get_agent_config(&agent_name)?;
    let skills_dir = SkillsManager::get_central_skills_dir();
    let skill_in_central = skills_dir.join(&skill_id);
    let skill_in_agent_dir = agent_config.path.join(&skill_id);

    fs::remove_file(&skill_in_agent_dir)?;
    std::os::unix::fs::symlink(&skill_in_central, &skill_in_agent_dir)?;

    // 2. Update agent_enabled state
    update_agent_enabled_state(&skill_id, &agent_name, true)?;

    Ok(())
}

#[tauri::command]
pub async fn disable_skill_for_agent(
    skill_id: String,
    agent_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Remove symlink from agent directory
    let agent_config = get_agent_config(&agent_name)?;
    let skill_in_agent_dir = agent_config.path.join(&skill_id);

    if skill_in_agent_dir.exists() {
        fs::remove_file(&skill_in_agent_dir)?;
    }

    // 2. Update agent_enabled state
    update_agent_enabled_state(&skill_id, &agent_name, false)?;

    Ok(())
}
```

### 5.2 Scan Logic Enhancement

Update `scan_skills_directory` to aggregate from multiple sources:

```rust
pub fn scan_centralized_skills() -> Result<Vec<SkillDisplayData>, ScannerError> {
    let mut all_skills = Vec::new();

    // 1. Scan central storage
    let central_dir = SkillsManager::get_central_skills_dir();
    if central_dir.exists() {
        for entry in WalkDir::new(&central_dir).max_depth(2) {
            if let Some(skill_dir) = entry.path().file_name() {
                if let Ok(skill) = load_centralized_skill(&skill_dir) {
                    all_skills.push(SkillDisplayData {
                        skill,
                        source: SkillSource::Centralized,
                        agent_enabled: HashMap::new(),  // Will be populated
                    });
                }
            }
        }
    }

    // 2. Scan agent directories
    for agent in get_all_agents() {
        let agent_dir = PathBuf::from(agent.path.replace("~", &home()));
        if agent_dir.exists() {
            for entry in WalkDir::new(&agent_dir.join("skills")).max_depth(2) {
                if let Some(skill_dir) = entry.path().file_name() {
                    if let Ok(skill) = load_agent_skill(&skill_dir) {
                        // Check if this skill also exists in central storage
                        let central_skill = find_in_central_storage(&skill.id);

                        if central_skill.is_some() {
                            // Merge agent_enabled states
                            skill.agent_enabled = merge_agent_states(
                                &skill.agent_enabled,
                                &central_skill.unwrap().agent_enabled,
                            );
                        }

                        all_skills.push(SkillDisplayData {
                            skill,
                            source: SkillSource::Agent,
                            agent_enabled: skill.agent_enabled,
                        });
                    }
                }
            }
        }
    }

    // 3. Sort and deduplicate
    all_skills.sort_by(|a, b| a.id.cmp(&b.id));
    all_skills.dedup_by(|a| &a.id);

    Ok(all_skills)
}
```

---

## 6. Frontend Implementation Requirements

### 6.1 Type Definitions

```typescript
interface CentralSkillMetadata extends SkillMetadata {
    source: 'centralized' | 'agent';
    source_path: string;  // Central or agent-specific
}

interface SkillDisplayData extends SkillMetadata {
    source: 'centralized' | 'agent';
}

// New types
interface AgentInstallationInfo {
    skill_id: string;
    source: 'centralized';
}

interface AgentSkillConfig {
    skill_id: string;
    enabled: boolean;
}
```

### 6.2 API Extensions

```typescript
export const centralizedSkillsApi = {
    // Install skill to central storage
    install: async (skillId: string, files: {
        name: string;
        description: string;
    version?: string;
    }): Promise<void> => {
        await invoke('install_centralized_skill', { skillId, files });
    },

    // Get all skills (central + agent directories)
    getAllSkills: async (): Promise<SkillDisplayData[]> => {
        return await invoke('scan_centralized_skills');
    },

    // Enable skill for specific agent
    enableForAgent: async (skillId: string, agent: string): Promise<void> => {
        await invoke('enable_skill_for_agent', { skillId, agent });
    },

    // Disable skill for specific agent
    disableForAgent: async (skillId: string, agent: string): Promise<void> => {
        await invoke('disable_skill_for_agent', { skillId, agent });
    },
};
```

---

## 7. Implementation Phases

### Phase 1: Backend Infrastructure (Priority: High)
- Add centralized skill storage directory logic
- Implement skill installation command
- Implement agent enable/disable commands
- Update scan logic to aggregate from multiple sources
- Add state persistence for agent_enabled

### Phase 2: Frontend UI Updates (Priority: High)
- Update Dashboard to use new scan API
- Implement agent-specific visibility logic
- Update skill cards to show source (central/agent)
- Update toggle logic to use new agent commands
- Add "Install from Marketplace" flow

### Phase 3: Integration Testing (Priority: Medium)
- Test skill installation
- Test agent-specific enable/disable
- Test visibility across different agents
- Test state persistence

---

## 8. Open Questions

1. **Conflict Detection**: What happens when two agents try to enable/disable the same skill simultaneously?
   - Option A: Last writer wins (simple)
   - Option B: Queue operations and notify user
   - Option C: Show conflict resolution dialog

2. **Skill Updates**: When a skill is updated in central storage, how do we update linked agents?
   - Option A: Auto-update (complex)
   - Option B: Manual refresh button
   - Option C: Real-time updates via file watcher

3. **Storage Management**: Should central skills also track which agents have them enabled?
   - Option A: Yes, store agent_enabled in metadata.json
   - Option B: No, check by scanning agent directories

---

## 9. Migration Path

### Option A: Clean Break (Recommended)
1. Keep current Phase 2 as is
2. Start Phase 3 in a new branch
3. Implement centralized storage completely
4. Migrate existing skills if needed
5. Test thoroughly before merging

### Option B: Gradual Evolution (Conservative)
1. Add centralized storage alongside current implementation
2. Allow both to coexist temporarily
3. Add migration tools
4. Slowly phase out old approach
5. More risk of complexity

---

**Recommendation**: Start with Option A (clean break) for clearer architecture.
