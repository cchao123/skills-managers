# Dashboard Module

This directory contains the refactored Dashboard page, split into smaller, more manageable components and hooks.

## Directory Structure

```
Dashboard/
├── index.tsx                 # Main Dashboard component (entry point)
├── components/              # React components
│   ├── SkillCard.tsx        # Individual skill card component
│   ├── StatsBar.tsx         # Statistics bar (total/enabled/disabled)
│   ├── SearchAndFilterBar.tsx  # Search box and filter buttons
│   ├── SkillDetailModal.tsx # Skill detail modal with file tree
│   ├── DeleteConfirmModal.tsx  # Delete confirmation modal
│   ├── DragDropOverlay.tsx  # Drag & drop overlay
│   └── ImportingOverlay.tsx # Importing progress overlay
├── hooks/                   # Custom React hooks
│   ├── useSkillData.ts      # Manage skills and agents data
│   ├── useSkillFilters.ts   # Manage search and filter state
│   ├── useSkillActions.ts   # Handle skill operations (toggle/delete)
│   ├── useSkillModal.ts     # Manage skill detail modal state
│   ├── useDragDrop.ts       # Handle drag & drop functionality
│   └── usePanelResize.ts    # Handle panel resize functionality
├── utils/                   # Utility functions
│   ├── formatters.ts        # Date/time formatting utilities
│   ├── skillHelpers.ts      # Skill icon/color utilities
│   └── agentHelpers.ts      # Agent icon utilities
└── constants/               # Constants
    ├── skillIcons.ts        # Skill icon and color pools
    └── panel.ts             # Panel size and z-index constants

> Agent icons/metadata are centralized in `src/constants/agents.ts`.
```

## Key Features

- **Modular Architecture**: Code split into focused components and hooks
- **Custom Hooks**: Reusable stateful logic extracted into hooks
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized with `useCallback` and `useMemo`
- **Maintainability**: Easier to test and modify individual pieces

## Component Responsibilities

### Main Component (`index.tsx`)
- Orchestrates all hooks and components
- Manages global state (expanded cards, delete target)
- Handles routing between different views

### Custom Hooks

- `useSkillData`: Fetches and manages skills/agents data
- `useSkillFilters`: Manages search term and filter type
- `useSkillActions`: Handles enable/disable/delete operations
- `useSkillModal`: Manages skill detail modal state and file operations
- `useDragDrop`: Sets up drag and drop event listeners
- `usePanelResize`: Manages resizable panel width

### Components

- `SkillCard`: Displays a single skill with toggle controls
- `StatsBar`: Shows skill statistics in header
- `SearchAndFilterBar`: Search input and filter buttons
- `SkillDetailModal`: Modal with file tree preview
- `DeleteConfirmModal`: Confirmation dialog for deletion
- `DragDropOverlay`: Visual feedback during drag & drop
- `ImportingOverlay`: Progress indicator during import

## Utilities

- `formatDate`: Converts timestamps to Chinese relative time
- `getSkillIcon/getSkillColor`: Deterministic icon/color selection
- `getAgentIcon/needsInvertInDark`: Agent icon utilities

## Migration Notes

The original `Dashboard.tsx` has been backed up to `Dashboard.tsx.bak`.
All functionality remains the same, just better organized.
