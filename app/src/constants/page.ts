/**
 * 应用顶层路由页面。
 *
 * 使用 `as const` 对象 + 派生类型替代 TS `enum`：
 * - 值仍是字符串，跟 sessionStorage / 老代码兼容
 * - 可 tree-shake，无运行时对象开销
 * - 可像枚举一样使用 `PAGE.Dashboard`
 */
export const PAGE = {
  Dashboard: 'dashboard',
  GitHubBackup: 'githubBackup',
  Settings: 'settings',
} as const;

export type Page = typeof PAGE[keyof typeof PAGE];

export const isPage = (v: unknown): v is Page =>
  v === PAGE.Dashboard || v === PAGE.GitHubBackup || v === PAGE.Settings;
