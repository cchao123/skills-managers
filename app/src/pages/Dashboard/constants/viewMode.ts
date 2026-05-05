/**
 * Dashboard 视图模式：
 * - Flat: 平铺视图（同 id 多来源合并为一张卡片）
 * - Agent: 按来源展示 / agent 分 tab 展示
 *
 * 使用 `as const` 对象 + 派生类型替代 TS `enum`，避免引入运行时冗余，
 * 同时可像枚举一样使用 `VIEW_MODE.Flat`。
 */
export const VIEW_MODE = {
  Flat: 'flat',
  Agent: 'agent',
} as const;

export type ViewMode = typeof VIEW_MODE[keyof typeof VIEW_MODE];

export const isViewMode = (v: unknown): v is ViewMode =>
  v === VIEW_MODE.Flat || v === VIEW_MODE.Agent;

export const VIEW_MODE_SHORTCUT_KEY = {
  [VIEW_MODE.Flat]: '1',
  [VIEW_MODE.Agent]: '2',
} as const;
