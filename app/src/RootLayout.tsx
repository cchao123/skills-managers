import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideNavBar from './components/SideNavBar';
import Dashboard from './pages/Dashboard';
import SkillDownload from './pages/Marketplace/SkillDownload';
import { SidebarProvider } from './contexts/SidebarContext';
import { isTauri } from '@/lib/tauri-env';
import { PAGE, pageToPath, pathToPage, type Page } from '@/constants';
import { TelemetryEvent } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';
/**
 * 应用根布局：承载 SideNavBar + 页面容器，作为所有子路由的 layout。
 *
 * Dashboard 始终挂载（用 display 切换可见性），避免每次切页都触发全盘文件扫描。
 * 其他页面通过 <Outlet /> 按需挂载。
 */
export default function RootLayout() {
  return (
    <SidebarProvider>
      <RootLayoutContent />
    </SidebarProvider>
  );
}

function RootLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage: Page = pathToPage(location.pathname);
  const isDashboard = currentPage === PAGE.Dashboard;
  const isSkillDownload = currentPage === PAGE.SkillDownload;

  useEffect(() => {
    if (isTauri()) {
      trackEvent(TelemetryEvent.PAGE_VIEW, { page: currentPage });
    }
  }, [currentPage]);

  // 全局快捷键 Cmd/Ctrl + A/S/D 切页
  // A=下载页, S=Dashboard, D=GitHub 备份
  // 注意：Cmd+A=全选, Cmd+S=保存——在输入框/可编辑区域内不拦截，避免打断输入。
  useEffect(() => {
    const PAGE_SHORTCUTS: Record<string, Page> = {
      a: PAGE.SkillDownload,
      s: PAGE.Dashboard,
      d: PAGE.GitHubBackup,
    };
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (isEditable(e.target)) return;
      const target = PAGE_SHORTCUTS[e.key.toLowerCase()];
      if (!target) return;
      e.preventDefault();
      navigate(pageToPath(target));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <div className="h-screen bg-[#f8f9fa] dark:bg-dark-bg-secondary flex">
      <SideNavBar />
      <main className="flex-1 h-screen overflow-hidden">
        {/* Dashboard 是最重的页面（扫描所有 SKILL.md），始终挂载避免每次切页都重新扫描。
            SkillDownload 同样始终挂载，保留下载进度状态。
            其他页面走 Outlet，按 Route 配置渲染。 */}
        <div
          className="h-full"
          style={{
            display: isDashboard ? 'block' : 'none',
            contentVisibility: isDashboard ? 'auto' : 'hidden'  // 跳过隐藏页面的渲染
          }}
        >
          <Dashboard
            isActive={isDashboard}
          />
        </div>
        <div
          className="h-full"
          style={{
            display: isSkillDownload ? 'block' : 'none',
            contentVisibility: isSkillDownload ? 'auto' : 'hidden'  // 跳过隐藏页面的渲染
          }}
        >
          <SkillDownload />
        </div>
        {!isDashboard && !isSkillDownload && <Outlet />}
      </main>
    </div>
  );
}
