# GitHubBackup Page Module

This directory contains the refactored GitHubBackup page, split into smaller, more manageable components and hooks.

## Directory Structure

```
GitHubBackup/
├── index.tsx                      # Main component (entry point)
├── constants/
│   └── config.ts                  # URLs, defaults, constants
├── hooks/
│   ├── useGitHubConfig.ts         # Config management
│   └── useGitHubActions.ts        # GitHub API actions
└── components/
    ├── StarButton.tsx             # Star repo button
    ├── GitHubForm.tsx             # Configuration form
    ├── ActionButtons.tsx          # Action buttons
    ├── ConfigGuide.tsx            # Setup guide
    └── StatusBadge.tsx            # Status badges
```

## Features

- **Auto-Save**: Debounced configuration auto-save (1 second delay)
- **Connection Testing**: Verify GitHub credentials before operations
- **Sync & Restore**: Push skills to GitHub or restore from backup
- **Star Integration**: Beautiful gradient star button with status tracking
- **Mock Mode**: Browser testing support with mock data
- **Error Handling**: Comprehensive error handling with toast notifications

## Component Overview

### Main Component (index.tsx)
- Orchestrates all hooks and components
- Manages loading states and error display
- Handles layout and responsive design

### Custom Hooks

**useGitHubConfig**
- Loads and saves GitHub configuration
- Debounced auto-save to avoid excessive API calls
- Mock mode support for browser testing
- Connection state management

**useGitHubActions**
- Tests GitHub connection
- Syncs skills to GitHub
- Restores skills from GitHub
- Stars/unstars repository
- Loading state management for each operation

### Components

**StarButton**
- Beautiful gradient design (yellow to amber)
- Status indicator (green dot when starred)
- Disabled state during loading
- Animated hover effects

**GitHubForm**
- Complete configuration form
- Owner, repo, branch, path, and token fields
- Password visibility toggle
- Disabled when connected
- Helper text and validation

**ActionButtons**
- Test Connection / Edit Config button
- Restore from GitHub button
- Push to GitHub button
- Proper disabled states during operations

**ConfigGuide**
- Expandable accordion guide
- 4-step setup instructions
- External links to GitHub
- Notice/warning section

**StatusBadge**
- Connection success badge
- Repository link badge
- Displays repo owner/name

## Constants

**config.ts**
- External URLs (GitHub, documentation)
- Default form values
- Star repository configuration
- Auto-save delay timing

## State Management

The page uses multiple pieces of state:
- `repoConfig`: Form field values
- `connected`: Whether connection has been tested
- `loading`: Initial data loading
- `saving`: Auto-save in progress
- `testing`, `syncing`, `restoring`: Operation states
- `starred`, `starring`: Star button states
- `guideOpen`: Config guide accordion state

## Auto-Save Behavior

- Triggers 1 second after any field change
- Only saves if required fields are filled (owner, repo, token)
- Shows "保存中..." indicator during save
- Automatically creates 'default' repository entry

## Error Handling

All operations have try-catch blocks with:
- Console error logging
- User-friendly toast notifications
- Proper error type detection
- Fallback to mock mode in browser

## Mock Mode

When running in browser (no Tauri):
- Uses mock configuration data
- Simulates API delays
- Allows UI testing without backend
- Console logs indicate mock mode
