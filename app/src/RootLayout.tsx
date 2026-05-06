import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideNavBar from './components/SideNavBar';
import Dashboard from './pages/Dashboard';
import { isTauri } from '@/lib/tauri-env';
import { PAGE, SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, pageToPath, pathToPage, type Page } from '@/constants';
import { TelemetryEvent } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';
import { VIEW_MODE, isViewMode, type ViewMode } from '@/pages/Dashboard/constants/viewMode';

/**
 * 应用根布局：承载 SideNavBar + 页面容器，作为所有子路由的 layout。
 *
 * Dashboard 始终挂载（用 display 切换可见性），避免每次切页都触发全盘文件扫描。
 * 其他页面通过 <Outlet /> 按需挂载。
 */
export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsedRaw] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEYS.sidebarCollapsed) === '1';
    } catch {
      return true; // 默认收起
    }
  });
  const setIsSidebarCollapsed = useCallback((value: boolean) => {
    setIsSidebarCollapsedRaw(value);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.sidebarCollapsed, value ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const [agentFilter, setAgentFilterRaw] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEYS.dashboardAgentFilter) ?? '';
    } catch {
      return '';
    }
  });
  const setAgentFilter = useCallback((value: string) => {
    setAgentFilterRaw(value);
    try {
      if (value) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.dashboardAgentFilter, value);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.dashboardAgentFilter);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  // Dashboard 视图模式：状态提到 RootLayout 仅是为了与其它跨页持久化保持一致；
  // 主要使用方仍是 Dashboard 自身。
  const [dashboardViewMode, setDashboardViewModeRaw] = useState<ViewMode>(() => {
    try {
      const v = sessionStorage.getItem(SESSION_STORAGE_KEYS.dashboardViewMode);
      return isViewMode(v) ? v : VIEW_MODE.Flat;
    } catch {
      return VIEW_MODE.Flat;
    }
  });
  const setDashboardViewMode = useCallback((mode: ViewMode) => {
    setDashboardViewModeRaw(mode);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.dashboardViewMode, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const currentPage: Page = pathToPage(location.pathname);
  const isDashboard = currentPage === PAGE.Dashboard;

  const setCurrentPage = (page: Page) => {
    navigate(pageToPath(page));
  };

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
      <SideNavBar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 h-screen overflow-hidden">
        {/* Dashboard 是最重的页面（扫描所有 SKILL.md），始终挂载避免每次切页都重新扫描。
            其他页面走 Outlet，按 Route 配置渲染。 */}
        <div
          className="h-full"
          style={{ display: isDashboard ? 'block' : 'none' }}
        >
          <Dashboard
            onNavigate={setCurrentPage}
            isActive={isDashboard}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            viewMode={dashboardViewMode}
            onViewModeChange={setDashboardViewMode}
          />
        </div>
        {!isDashboard && <Outlet />}
      </main>
    </div>
  );
}
