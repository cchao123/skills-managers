import { useState, useEffect } from 'react';
import SideNavBar from './components/SideNavBar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import GitHubBackup from './pages/GitHubBackup';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { invoke } from '@tauri-apps/api/core';
import i18n from './i18n/config';
import { isTauri } from '@/lib/tauri-env';
import { PAGE, THEME, type Page } from '@/constants';
import { TelemetryEvent } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(PAGE.Dashboard);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 启动时同步前端语言到托盘
  useEffect(() => {
    if (isTauri()) {
      invoke('update_tray_language', { lang: i18n.language }).catch(() => {});
      trackEvent(TelemetryEvent.APP_OPENED, { page: PAGE.Dashboard });
    }
  }, []);

  // 追踪页面切换
  useEffect(() => {
    if (isTauri()) {
      trackEvent(TelemetryEvent.PAGE_VIEW, { page: currentPage });
    }
  }, [currentPage]);

  return (
    <ThemeProvider defaultTheme={THEME.Light}>
      <ToastProvider>
      <div className="h-screen bg-[#f8f9fa] dark:bg-dark-bg-secondary">
        <SideNavBar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main
          className={`h-screen overflow-hidden ${
            isSidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
        >
          {currentPage === PAGE.Dashboard && <Dashboard onNavigate={setCurrentPage} />}
          {currentPage === PAGE.GitHubBackup && <GitHubBackup />}
          {currentPage === PAGE.Settings && <Settings />}
        </main>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
