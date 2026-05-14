import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './RootLayout';
import GitHubBackup from './pages/GitHubBackup';
import Settings from './pages/Settings';
import SkillDownload from './pages/Marketplace/SkillDownload';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { invoke } from '@tauri-apps/api/core';
import i18n from './i18n/config';
import { isTauri } from '@/lib/tauri-env';
import { PAGE, THEME, ROUTE_PATH } from '@/constants';
import { TelemetryEvent } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';

function App() {
  useEffect(() => {
    if (isTauri()) {
      invoke('update_tray_language', { lang: i18n.language }).catch(() => {});
      trackEvent(TelemetryEvent.APP_OPENED, { page: PAGE.Dashboard });
    }
  }, []);

  return (
    <ThemeProvider defaultTheme={THEME.Light}>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<RootLayout />}>
              {/* 默认跳转到下载页；Dashboard 由 RootLayout 始终挂载，始终可访问。 */}
              <Route index element={<Navigate to={ROUTE_PATH.SkillDownload} replace />} />
              <Route path={ROUTE_PATH.GitHubBackup.replace(/^\//, '')} element={<GitHubBackup />} />
              <Route path={ROUTE_PATH.Settings.replace(/^\//, '')} element={<Settings />} />
              <Route path={ROUTE_PATH.SkillDownload.replace(/^\//, '')} element={<SkillDownload />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
