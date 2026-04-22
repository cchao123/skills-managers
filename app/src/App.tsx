import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './RootLayout';
import GitHubBackup from './pages/GitHubBackup';
import Settings from './pages/Settings';
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
              {/* Dashboard 由 RootLayout 直接渲染（始终挂载），此处 index 只用于匹配根路径。 */}
              <Route index element={null} />
              <Route path={ROUTE_PATH.GitHubBackup.replace(/^\//, '')} element={<GitHubBackup />} />
              <Route path={ROUTE_PATH.Settings.replace(/^\//, '')} element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
