import { useState, useEffect } from 'react';
import SideNavBar from './components/SideNavBar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import GitHubBackup from './pages/GitHubBackup';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { invoke } from '@tauri-apps/api/core';
import i18n from './i18n/config';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 启动时同步前端语言到托盘
  useEffect(() => {
    if ((window as any).__TAURI__) {
      invoke('update_tray_language', { lang: i18n.language }).catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider>
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
          {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
          {currentPage === 'githubBackup' && <GitHubBackup />}
          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
