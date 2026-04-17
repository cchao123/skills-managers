// GitHub URLs
export const GITHUB_URLS = {
  REPO: 'https://github.com/cchao123/skills-managers',
  RELEASES: 'https://github.com/cchao123/skills-managers/releases',
  ISSUES: 'https://github.com/cchao123/skills-managers/issues',
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

// Theme options: 重用 @/constants/theme 中的 THEME / Theme
import { THEME, type Theme } from '@/constants';
export { THEME, type Theme };

export const THEME_OPTIONS = [
  { value: THEME.Light, labelKey: 'settings.themeLight', icon: 'light_mode' },
  { value: THEME.Dark, labelKey: 'settings.themeDark', icon: 'dark_mode' },
  { value: THEME.Auto, labelKey: 'settings.themeAuto', icon: 'brightness_auto' },
] as const satisfies ReadonlyArray<{ value: Theme; labelKey: string; icon: string }>;

// Settings 页签
export const TAB_TYPE = {
  General: 'general',
  Agents: 'agents',
  About: 'about',
  Changelog: 'changelog',
} as const;

export type TabType = typeof TAB_TYPE[keyof typeof TAB_TYPE];

export const DEFAULT_TAB: TabType = TAB_TYPE.General;
