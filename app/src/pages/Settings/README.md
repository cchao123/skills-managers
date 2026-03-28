# Settings & GitHubBackup Pages Refactoring

This directory contains the refactored Settings and GitHubBackup pages, split into smaller, more manageable components and hooks.

## Settings Directory Structure

```
Settings/
├── index.tsx                      # Main Settings component (entry point)
├── constants/
│   └── config.ts                  # URLs, languages, themes, tabs
├── hooks/
│   └── useSettingsData.ts         # Settings data management
└── components/
    ├── LanguageSection.tsx        # Language selection component
    ├── AppearanceSection.tsx      # Theme/appearance settings
    ├── AgentsSection.tsx          # Agent management section
    ├── LinkingStrategySection.tsx # Linking strategy options
    ├── ActionsSection.tsx         # Action buttons (open folder)
    └── AboutSection.tsx            # About page
```

## GitHubBackup Directory Structure

```
GitHubBackup/
├── index.tsx                      # Main GitHubBackup component (entry point)
├── constants/
│   └── config.ts                  # URLs, defaults, constants
├── hooks/
│   ├── useGitHubConfig.ts         # Config management with auto-save
│   └── useGitHubActions.ts        # GitHub API actions (test/sync/restore/star)
└── components/
    ├── StarButton.tsx             # Star repo button with gradient effect
    ├── GitHubForm.tsx             # Configuration form
    ├── ActionButtons.tsx          # Test/Sync/Restore buttons
    ├── ConfigGuide.tsx            # Expandable configuration guide
    └── StatusBadge.tsx            # Connection status badges
```

## Key Features

### Settings Page
- **Modular Components**: Each section (language, appearance, agents, etc.) is a separate component
- **Custom Hook**: `useSettingsData` manages all settings-related data and operations
- **Constants**: URLs, language list, and theme options extracted to constants
- **Type Safety**: Full TypeScript support with proper types

### GitHubBackup Page
- **Auto-Save**: Debounced auto-save functionality (1 second delay)
- **Connection Management**: Test connection before sync/restore operations
- **Star Feature**: Beautiful gradient star button with status indicator
- **Error Handling**: Proper error handling and user feedback via toasts
- **Responsive**: Grid layout adapts to screen size

## Component Responsibilities

### Settings Components

- **LanguageSection**: Displays language options (Chinese/English) with selection state
- **AppearanceSection**: Shows theme options (Light/Dark/Auto) with visual selection
- **AgentsSection**: Lists detected agents with detect button
- **LinkingStrategySection**: Radio buttons for Symlink vs Copy strategy
- **ActionsSection**: Button to open skills folder
- **AboutSection**: App info, version, and external links

### GitHubBackup Components

- **StarButton**: Gradient star button with status indicator
- **GitHubForm**: Complete configuration form with all fields
- **ActionButtons**: Test, Edit, Restore, and Sync buttons
- **ConfigGuide**: Expandable accordion with setup instructions
- **StatusBadge**: Shows connection status and repository link

## Custom Hooks

### useSettingsData (Settings)
Manages:
- Agent detection and configuration
- Linking strategy
- Skills folder operations
- Initial data loading

### useGitHubConfig (GitHubBackup)
Manages:
- GitHub repository configuration
- Auto-save with debouncing (1s delay)
- Mock mode for browser testing
- Loading states

### useGitHubActions (GitHubBackup)
Manages:
- Connection testing
- Push to GitHub (sync)
- Restore from GitHub
- Star repository functionality

## Migration Notes

- Original `Settings.tsx` backed up to `Settings.tsx.bak`
- Original `GitHubBackup.tsx` backed up to `GitHubBackup.tsx.bak`
- All functionality preserved, just better organized
- `App.tsx` imports remain unchanged (imports from directory)

## Benefits

1. **Maintainability**: Easier to locate and modify specific features
2. **Testability**: Individual components can be tested in isolation
3. **Reusability**: Components and hooks can be reused elsewhere
4. **Readability**: Smaller files are easier to understand
5. **Performance**: Optimized with proper React patterns (useCallback, useMemo)
6. **Type Safety**: Comprehensive TypeScript types
