// GitHub URLs
export const GITHUB_URLS = {
  REPO: 'https://github.com/cchao123/skills-managers',
  RELEASES: 'https://github.com/cchao123/skills-managers/releases',
  HOME: 'https://github.com',
} as const;

// External URLs
export const EXTERNAL_URLS = {
  DOCS: 'https://docs.anthropic.com',
} as const;

// Languages configuration
export const LANGUAGES = [
  { code: 'zh', name: '中文', abbr: '中' },
  { code: 'en', name: 'English', abbr: 'EN' },
] as const;

// Theme options configuration
export type Theme = 'light' | 'dark' | 'auto';

export const THEME_OPTIONS = [
  { value: 'light' as Theme, labelKey: 'settings.themeLight', icon: 'light_mode' },
  { value: 'dark' as Theme, labelKey: 'settings.themeDark', icon: 'dark_mode' },
  { value: 'auto' as Theme, labelKey: 'settings.themeAuto', icon: 'brightness_auto' },
] as const;

// Tab types
export type TabType = 'general' | 'agents' | 'about' | 'changelog';

export const DEFAULT_TAB: TabType = 'general';
