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

/**
 * 路由路径常量。Dashboard 走 index 路由 `/`，保持 URL 简短。
 * 与 Page 之间用 `pageToPath` / `pathToPage` 相互转换。
 */
export const ROUTE_PATH = {
  Dashboard: '/',
  GitHubBackup: '/github',
  Settings: '/settings',
} as const;

export const pageToPath = (page: Page): string => {
  switch (page) {
    case PAGE.GitHubBackup:
      return ROUTE_PATH.GitHubBackup;
    case PAGE.Settings:
      return ROUTE_PATH.Settings;
    case PAGE.Dashboard:
    default:
      return ROUTE_PATH.Dashboard;
  }
};

export const pathToPage = (pathname: string): Page => {
  if (pathname.startsWith(ROUTE_PATH.GitHubBackup)) return PAGE.GitHubBackup;
  if (pathname.startsWith(ROUTE_PATH.Settings)) return PAGE.Settings;
  return PAGE.Dashboard;
};
