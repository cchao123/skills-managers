/** sessionStorage 键名 — 勿随意改动，以免用户会话状态丢失 */

export const SESSION_STORAGE_KEYS = {
  settingsInitialTab: 'settingsInitialTab',
  githubTipDismissed: 'githubTipDismissed',
  dashboardViewMode: 'skills-manager:dashboard:viewMode',
  /** v2：默认来源 global，与旧键分离 */
  dashboardSelectedSourceV2: 'skills-manager:dashboard:selectedSourceV2',
  dashboardSearchTerm: 'skills-manager:dashboard:searchTerm',
} as const;

/** localStorage 键名 — 持久化偏好设置 */
export const LOCAL_STORAGE_KEYS = {
  advancedMode: 'skills-manager:advancedMode',
  /** 按前缀隐藏 skill（例如飞书 CLI 注入的 `lark-*`），存 JSON 字符串数组 */
  skillHidePrefixes: 'skills-manager:skillHidePrefixes',
} as const;
