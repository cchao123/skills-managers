import { useCallback, useState } from 'react';
import { HashRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideNavBar from '@/components/SideNavBar';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import { PAGE, pathToPage, pageToPath, ROUTE_PATH, SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, THEME, type Page } from '@/constants';
import PreviewOnlyDesktop from './PreviewOnlyDesktop';
import { VIEW_MODE, isViewMode, type ViewMode } from '@/pages/Dashboard/constants/viewMode';

function PreviewLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsedRaw] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEYS.sidebarCollapsed) === '1';
    } catch {
      return false;
    }
  });
  const setIsSidebarCollapsed = useCallback((value: boolean) => {
    setIsSidebarCollapsedRaw(value);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.sidebarCollapsed, value ? '1' : '0');
    } catch { /* ignore */ }
  }, []);

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
    } catch { /* ignore */ }
  }, []);

  const currentPage: Page = pathToPage(location.pathname);
  const isDashboard = currentPage === PAGE.Dashboard;

  const setCurrentPage = (page: Page) => navigate(pageToPath(page));

  return (
    <div className="h-screen bg-[#f8f9f9] dark:bg-dark-bg-secondary flex">
      <SideNavBar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 h-screen overflow-hidden">
        <div className="h-full" style={{ display: isDashboard ? 'block' : 'none' }}>
          <Dashboard
            onNavigate={setCurrentPage}
            isActive={isDashboard}
            viewMode={dashboardViewMode}
            onViewModeChange={setDashboardViewMode}
          />
        </div>
        {!isDashboard && <Outlet />}
      </main>
    </div>
  );
}

export default function PreviewApp() {
  return (
    <ThemeProvider defaultTheme={THEME.Light}>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<PreviewLayout />}>
              <Route index element={null} />
              <Route
                path={ROUTE_PATH.GitHubBackup.replace(/^\//, '')}
                element={<PreviewOnlyDesktop feature="github" />}
              />
              <Route
                path={ROUTE_PATH.Settings.replace(/^\//, '')}
                element={<Settings />}
              />
              <Route
                path={ROUTE_PATH.SkillDownload.replace(/^\//, '')}
                element={<PreviewOnlyDesktop feature="marketplace" />}
              />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
