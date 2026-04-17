/**
 * 技能列表过滤类型：全部 / 已启用 / 已禁用。
 * 使用 `as const` + 派生类型替代 TS `enum`。
 */
export const FILTER_TYPE = {
  All: 'all',
  Enabled: 'enabled',
  Disabled: 'disabled',
} as const;

export type FilterType = typeof FILTER_TYPE[keyof typeof FILTER_TYPE];
