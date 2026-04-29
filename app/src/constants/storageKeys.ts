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
  /** 顶部「按 Agent 快筛」选中的 source id；'' = 不筛选；跨重启持久化 */
  dashboardAgentFilter: 'skills-manager:dashboard:agentFilter',
  /** 侧边栏是否折叠；'1' = 折叠，'0' / 缺省 = 展开；跨重启持久化 */
  sidebarCollapsed: 'skills-manager:sidebar:collapsed',
  /** Dashboard 顶部搜索栏自定义显示项；存 JSON `{ showFilter, showSearch, showActions }` */
  searchBarPrefs: 'skills-manager:dashboard:searchBarPrefs',
  /** Agent 列表的自定义排列顺序；存 JSON 字符串数组（agent name） */
  agentsOrder: 'skills-manager:agents:order',
  /** 隐藏的 agent name 列表；存 JSON 字符串数组 */
  hiddenAgents: 'skills-manager:agents:hidden',
} as const;
