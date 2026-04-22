import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideNavBar from './components/SideNavBar';
import Dashboard from './pages/Dashboard';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  return (
    <div className="h-screen bg-[#f8f9fa] dark:bg-dark-bg-secondary">
      <SideNavBar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`h-screen overflow-hidden ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Dashboard 是最重的页面（扫描所有 SKILL.md），始终挂载避免每次切页都重新扫描。
            其他页面走 Outlet，按 Route 配置渲染。 */}
        <div
          className="h-full"
          style={{ display: isDashboard ? 'block' : 'none' }}
        >
          <Dashboard onNavigate={setCurrentPage} isActive={isDashboard} />
        </div>
        {!isDashboard && <Outlet />}
      </main>
    </div>
  );
}
