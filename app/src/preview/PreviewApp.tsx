import { HashRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import SideNavBar from '@/components/SideNavBar';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';
import SkillDownloadPreview from '@/pages/SkillDownloadPreview';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { PAGE, pathToPage, ROUTE_PATH, THEME } from '@/constants';
import PreviewOnlyDesktop from './PreviewOnlyDesktop';

function PreviewLayout() {
  const location = useLocation();
  const currentPage = pathToPage(location.pathname);
  const isDashboard = currentPage === PAGE.Dashboard;
  const isSkillDownload = currentPage === PAGE.SkillDownload;

  return (
    <div className="h-screen bg-[#f8f9f9] dark:bg-dark-bg-secondary flex">
      <SideNavBar />
      <main className="flex-1 h-screen overflow-hidden">
        <div className="h-full" style={{ display: isDashboard ? 'block' : 'none' }}>
          <Dashboard isActive={isDashboard} />
        </div>
        <div className="h-full" style={{ display: isSkillDownload ? 'block' : 'none' }}>
          <SkillDownloadPreview />
        </div>
        {!isDashboard && !isSkillDownload && <Outlet />}
      </main>
    </div>
  );
}

export default function PreviewApp() {
  return (
    <ThemeProvider defaultTheme={THEME.Light}>
      <ToastProvider>
        <SidebarProvider>
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
                element={null}
              />
            </Route>
          </Routes>
        </HashRouter>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
