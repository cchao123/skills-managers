/**
 * 应用主题：浅色 / 深色 / 跟随系统。
 *
 * 使用 `as const` 对象 + 派生类型替代 TS `enum`。
 */
export const THEME = {
  Light: 'light',
  Dark: 'dark',
  Auto: 'auto',
} as const;

export type Theme = typeof THEME[keyof typeof THEME];

/** 解析后的实际主题（不含 `auto`）。 */
export type ResolvedTheme = typeof THEME.Light | typeof THEME.Dark;

export const isTheme = (v: unknown): v is Theme =>
  v === THEME.Light || v === THEME.Dark || v === THEME.Auto;
