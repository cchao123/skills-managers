/**
 * 前端模块间通信使用的自定义 `window` 事件名。
 * 统一放这里，避免字符串散落在各组件里打错、难以追踪派发 / 监听方。
 */
export const WINDOW_EVENTS = {
  /** 通知 Settings 页切换 tab；payload 为 `CustomEvent<TabType>` 的 detail 字段。 */
  settingsSetTab: 'settings:set-tab',
  /** 通知 Dashboard 重新静默拉取 skills 列表（如 GitHub 同步/恢复完成后）。 */
  skillsRefresh: 'skills:refresh',
} as const;

/**
 * 统一的事件名称定义
 * 用于 Aptabase 事件追踪
 */
export enum TelemetryEvent {
  // 应用生命周期事件
  APP_STARTED = 'app_started',
  APP_OPENED = 'app_opened',
  APP_READY = 'app_ready',
  APP_EXITED = 'app_exited',

  // 页面导航事件
  PAGE_VIEW = 'page_view',

  // 技能管理事件
  SKILL_ENABLED = 'skill_enabled',
  SKILL_DISABLED = 'skill_disabled',
  SKILL_DELETED = 'skill_deleted',

  // Agent 技能事件
  SKILL_AGENT_ENABLED = 'skill_agent_enabled',
  SKILL_AGENT_DISABLED = 'skill_agent_disabled',

  // GitHub 相关事件
  GITHUB_TEST_LINK_CLICKED = 'github_test_link_clicked',
  GITHUB_SYNC_CLICKED = 'github_sync_clicked',
  GITHUB_RESTORE_CLICKED = 'github_restore_clicked',
}

/**
 * 事件属性类型定义
 */
export interface TelemetryEventProps {
  [key: string]: string | number | undefined;

  // 页面属性
  page?: string;

  // 技能属性
  skill_id?: string;
  source?: string;
  agent?: string;

  // 应用属性
  timestamp?: number;
  test?: string;
}
