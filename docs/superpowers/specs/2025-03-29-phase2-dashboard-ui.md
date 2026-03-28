# Phase 2: Dashboard UI - Design Document

**Date:** 2025-03-29
**Status:** Design Approved
**Type:** Frontend Development
**Scope:** Dashboard UI with Backend Integration

---

## Overview

Phase 2 focuses on connecting the Phase 1 backend infrastructure to the frontend, implementing the Dashboard UI with real API calls, and adding Agent management functionality to the Settings page.

**Goals:**
- Replace mock data with real backend API calls
- Fix data model mismatches between frontend and backend
- Implement Agent management UI
- Improve user experience for skill and agent configuration

**Approach:** Gradual integration (渐进式集成) - Update layer by layer, maintaining stability

---

## Architecture

### Layer Architecture

```
┌─────────────────────────────────────────┐
│         UI Components (React)           │
│  ┌──────────┐      ┌──────────────┐    │
│  │Dashboard │      │  Settings    │    │
│  └────┬─────┘      └──────┬───────┘    │
└───────┼──────────────────┼─────────────┘
        │                  │
┌───────┼──────────────────┼─────────────┐
│       │   Data Layer     │              │
│  ┌────┴─────┐      ┌─────┴──────┐      │
│  │ Adapter  │      │  Types     │      │
│  │(新)      │      │  (更新)    │      │
│  └────┬─────┘      └────────────┘      │
└───────┼─────────────────────────────────┘
        │
┌───────┼─────────────────────────────────┐
│       │   API Layer                     │
│  ┌────┴────────────────────────────┐    │
│  │ tauri.ts (扩展)                  │    │
│  │ - skillsApi (修正参数)           │    │
│  │ - agentsApi (新增)               │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────┐
│       │   Backend (Rust)                │
│  ┌────┴────────────────────────────┐    │
│  │ Tauri Commands (Phase 1)         │    │
│  │ - 12 commands                    │    │
│  │ - 更新默认预设: 3 → 5 agents     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Data Models

### Type Definitions Update

**File:** `app/src/types/index.ts`

```typescript
// Skill Metadata (matches backend)
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  agent_enabled: Record<string, boolean>;  // Changed from agent_disabled
  source_path: string;
  version?: string;
}

// Agent Configuration (matches backend)
export interface AgentConfig {
  name: string;
  display_name: string;
  path: string;
  skills_path: string;
  enabled: boolean;
  detected: boolean;
}

// Application Configuration (matches backend)
export interface AppConfig {
  linking_strategy: 'Symlink' | 'Copy';
  agents: AgentConfig[];
}
```

### Data Adapter

**File:** `app/src/adapters/skillAdapter.ts` (new)

```typescript
import type { SkillMetadata } from '../types';

interface BackendSkillMetadata {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  agent_enabled: Record<string, boolean>;
  source_path: string;
  version?: string;
}

export const adaptSkillMetadata = (
  backendData: BackendSkillMetadata
): SkillMetadata => {
  return {
    id: backendData.id,
    name: backendData.name,
    description: backendData.description,
    enabled: backendData.enabled,
    agent_enabled: backendData.agent_enabled || {},
    source_path: backendData.source_path,
    version: backendData.version,
  };
};

export const adaptSkillMetadataList = (
  backendList: BackendSkillMetadata[]
): SkillMetadata[] => {
  return backendList.map(adaptSkillMetadata);
};
```

---

## API Layer

### skillsApi Updates

**File:** `app/src/api/tauri.ts`

**Changes:**
- Parameter name: `pluginName` → `skillId`
- Added optional `agent` parameter for enable/disable
- Added adapter for data transformation

```typescript
export const skillsApi = {
  list: async (): Promise<SkillMetadata[]> => {
    const data = await invoke<SkillMetadata[]>('list_skills');
    return adaptSkillMetadataList(data);
  },

  enable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('enable_skill', { skillId, agent });
  },

  disable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('disable_skill', { skillId, agent });
  },

  getContent: async (skillId: string): Promise<string> => {
    return await invoke('get_skill_content', { skillId });
  },

  rescan: async (): Promise<SkillMetadata[]> => {
    const data = await invoke<SkillMetadata[]>('rescan_skills');
    return adaptSkillMetadataList(data);
  },
};
```

### agentsApi (New)

```typescript
export const agentsApi = {
  list: async (): Promise<AgentConfig[]> => {
    return await invoke<AgentConfig[]>('get_agents');
  },

  add: async (agent: AgentConfig): Promise<void> => {
    await invoke('add_agent', { agent });
  },

  remove: async (name: string): Promise<void> => {
    await invoke('remove_agent', { name });
  },

  getConfig: async (): Promise<AppConfig> => {
    return await invoke<AppConfig>('get_config');
  },

  setLinkingStrategy: async (strategy: 'Symlink' | 'Copy'): Promise<void> => {
    await invoke('set_linking_strategy', { strategy });
  },

  openFolder: async (): Promise<void> => {
    await invoke('open_skills_manager_folder');
  },

  detect: async (): Promise<AgentConfig[]> => {
    return await invoke<AgentConfig[]>('detect_agents');
  },
};
```

---

## Components

### AgentToggleItem Component

**File:** `app/src/components/AgentToggleItem.tsx` (new)

**Purpose:** Reusable component for per-agent skill enable/disable toggles

**Props:**
- `agent: AgentConfig` - Agent configuration
- `skill: SkillMetadata` - Skill metadata
- `onToggle: () => void` - Toggle callback
- `is_enabled: boolean` - Current enabled state

**Features:**
- Shows detection status icon (✓ or ?)
- Disables toggle for undetected agents
- Displays agent display name

### AgentCard Component

**File:** `app/src/components/AgentCard.tsx` (new)

**Purpose:** Display agent information and configuration in Settings page

**Props:**
- `agent: AgentConfig` - Agent configuration
- `onToggle: () => void` - Toggle callback

**Features:**
- Detection status badge
- Path display
- Enable/disable toggle

---

## Pages

### Dashboard Page Updates

**File:** `app/src/pages/Dashboard.tsx`

**Changes:**

1. **Remove Mock Data**
   - Delete `FORCE_MOCK_DATA`
   - Delete `mockSkills` array
   - Delete `useMock` state

2. **Fix Agent Toggle Logic**
   ```typescript
   // OLD (incorrect)
   const newAgentDisabled = {
     ...skill.agent_disabled,
     [agentKey]: !skill.agent_disabled[agentKey]
   };

   // NEW (correct)
   const handleToggleAgent = async (skill: SkillMetadata, agentName: string) => {
     const isEnabled = skill.agent_enabled[agentName];

     if (isEnabled) {
       await skillsApi.disable(skill.id, agentName);
     } else {
       await skillsApi.enable(skill.id, agentName);
     }

     await loadSkills();
   };
   ```

3. **Add Agent State Management**
   ```typescript
   const [agents, setAgents] = useState<AgentConfig[]>([]);

   useEffect(() => {
     loadAgents();
   }, []);

   const loadAgents = async () => {
     try {
       const agentsData = await agentsApi.list();
       setAgents(agentsData);
     } catch (error) {
       console.error('Failed to load agents:', error);
     }
   };
   ```

4. **Improved Visual Feedback**
   - Show enabled agent count: "✓ 3 个 Agent 已启用"
   - Detection status icons in expanded panel
   - Disable toggles for undetected agents

### Settings Page Updates

**File:** `app/src/pages/Settings.tsx`

**Changes:**

1. **Add New Tab**
   ```typescript
   type TabType = 'general' | 'agents' | 'about' | 'changelog';

   const tabs = [
     { id: 'general' as TabType, label: t('settings.tabGeneral'), icon: 'tune' },
     { id: 'agents' as TabType, label: t('settings.tabAgents'), icon: 'smart_toy' }, // NEW
     { id: 'about' as TabType, label: t('settings.tabAbout'), icon: 'info' },
     { id: 'changelog' as TabType, label: t('settings.tabChangelog'), icon: 'history' },
   ];
   ```

2. **Add Agents Tab Content**
   - Agent Management section (5 agent cards)
   - Linking Strategy section
   - Actions section (Open Skills Folder button)

3. **Preserve Existing Tabs**
   - General Tab (Appearance, Language)
   - About Tab (unchanged)
   - Changelog Tab (unchanged)

---

## Backend Updates

### Default Agent Presets

**File:** `src-tauri/src/settings.rs`

**Change:** Update `load_or_create()` to create 5 default agents instead of 3

**Before:**
```rust
default.agents = vec![
    // Claude Code, Cursor, Windsurf (3 agents)
];
```

**After:**
```rust
default.agents = vec![
    AgentConfig {
        name: "claude".to_string(),
        display_name: "Claude".to_string(),
        path: "~/.claude".to_string(),
        skills_path: "skills/plugins".to_string(),
        enabled: true,
        detected: false,
    },
    AgentConfig {
        name: "cursor".to_string(),
        display_name: "Cursor".to_string(),
        path: "~/.cursor".to_string(),
        skills_path: "skills".to_string(),
        enabled: true,
        detected: false,
    },
    AgentConfig {
        name: "codex".to_string(),
        display_name: "Codex".to_string(),
        path: "~/.codex".to_string(),
        skills_path: "skills".to_string(),
        enabled: true,
        detected: false,
    },
    AgentConfig {
        name: "openclaw".to_string(),
        display_name: "OpenClaw".to_string(),
        path: "~/.openclaw".to_string(),
        skills_path: "skills".to_string(),
        enabled: true,
        detected: false,
    },
    AgentConfig {
        name: "opencode".to_string(),
        display_name: "OpenCode".to_string(),
        path: "~/.opencode".to_string(),
        skills_path: "skills".to_string(),
        enabled: true,
        detected: false,
    },
];
```

### Test Updates

**File:** `src-tauri/src/settings_test.rs`

**Update:** `test_create_default_config` to expect 5 agents

```rust
#[test]
fn test_create_default_config() {
    // ...
    assert_eq!(config.agents.len(), 5);  // Changed from 3
    assert_eq!(config.agents[0].name, "claude");
    assert_eq!(config.agents[1].name, "cursor");
    assert_eq!(config.agents[2].name, "codex");
    assert_eq!(config.agents[3].name, "openclaw");
    assert_eq!(config.agents[4].name, "opencode");
}
```

---

## Implementation Plan

### Day 1: Data Layer + API Layer
- Update type definitions in `types/index.ts`
- Create `adapters/skillAdapter.ts`
- Update `api/tauri.ts` with corrected skillsApi
- Add agentsApi to `api/tauri.ts`
- Test API calls with backend

### Day 2: Dashboard Improvements
- Remove mock data from `Dashboard.tsx`
- Fix agent toggle logic (agent_enabled)
- Add agent state management
- Create `AgentToggleItem` component
- Update expanded panel to show all agents
- Test with real backend

### Day 3: Settings Page
- Add "agents" tab to Settings
- Create `AgentCard` component
- Implement Agents tab content
- Add linking strategy UI
- Add "Open Skills Folder" button
- Test all Settings functionality

### Day 4: Backend Updates + Integration Testing
- Update default agents in `settings.rs` (3 → 5)
- Update tests in `settings_test.rs`
- Run all tests to ensure pass
- End-to-end testing of Dashboard and Settings
- Fix any integration issues

---

## File Structure

```
app/src/
├── adapters/
│   └── skillAdapter.ts           # NEW
├── api/
│   └── tauri.ts                   # MODIFY (add agentsApi)
├── components/
│   ├── AgentToggleItem.tsx        # NEW
│   ├── AgentCard.tsx              # NEW
│   └── ... (existing components)
├── pages/
│   ├── Dashboard.tsx              # MODIFY
│   └── Settings.tsx               # MODIFY (add agents tab)
└── types/
    └── index.ts                   # MODIFY

src-tauri/src/
├── settings.rs                    # MODIFY (5 default agents)
└── settings_test.rs               # MODIFY (update tests)
```

---

## Success Criteria

### Functional Requirements
- ✅ Dashboard displays real data from backend API
- ✅ Skills can be enabled/disabled globally
- ✅ Skills can be enabled/disabled per agent
- ✅ Settings page shows all 5 agents
- ✅ Agent detection status is visualized
- ✅ Linking strategy can be changed
- ✅ Skills folder can be opened

### Non-Functional Requirements
- ✅ No mock data in production
- ✅ Type-safe API calls
- ✅ Error handling with user feedback
- ✅ Loading states for async operations
- ✅ Responsive design maintained
- ✅ All existing features preserved

### Testing
- ✅ All 15 backend tests pass
- ✅ Dashboard loads skills from backend
- ✅ Agent toggles work correctly
- ✅ Settings page loads agents
- ✅ Agent detection updates status

---

## Risks and Mitigations

### Risk 1: Data Model Mismatch
**Mitigation:** Use adapter pattern to handle differences, gradual migration

### Risk 2: Breaking Existing Features
**Mitigation:** Preserve all existing tabs and functionality, only add new features

### Risk 3: Agent Toggle Logic Confusion
**Mitigation:** Clear visual feedback, disable undetected agents, helpful tooltips

### Risk 4: Backend API Changes
**Mitigation:** Backend changes are minimal (only default agents), no API signature changes

---

## Post-Phase 2 Considerations

### Future Enhancements
- Add agent enable/disable toggle in Settings
- Add custom agent creation
- Add skill state persistence
- Add batch operations for skills
- Improve error messages and user feedback

### Technical Debt
- Remove adapter once frontend fully migrates
- Add comprehensive error boundaries
- Add loading skeletons for better UX
- Consider using React Query for data fetching

---

**Document Version:** 1.0.0
**Last Updated:** 2025-03-29
**Status:** Ready for Implementation Planning
