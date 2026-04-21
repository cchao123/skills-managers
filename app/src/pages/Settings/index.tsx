import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import PageHeader from '@/components/PageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsData } from './hooks/useSettingsData';
import { GITHUB_URLS, DEFAULT_TAB, TAB_TYPE, type TabType, type Theme } from './constants/config';
import { LanguageSection } from './components/LanguageSection';
import { AppearanceSection } from './components/AppearanceSection';
import { AgentsSection } from './components/AgentsSection';
import { SkillFilterSection } from './components/SkillFilterSection';
import { AboutSection } from './components/AboutSection';
import { AdvancedSection } from './components/AdvancedSection';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri-env';
import { SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, WINDOW_EVENTS } from '@/constants';

function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>(DEFAULT_TAB);

  useEffect(() => {
    const initialTab = sessionStorage.getItem(SESSION_STORAGE_KEYS.settingsInitialTab) as TabType | null;
    if (initialTab) {
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.settingsInitialTab);
      setActiveTab(initialTab);
    }
  }, []);

  // 在 Settings 页时（组件已挂载、不会重新触发上面的初始化 useEffect），
  // 通过自定义事件支持外部切 tab，例如点击侧边栏 logo 跳到"关于"。
  useEffect(() => {
    const validTabs = new Set<string>(Object.values(TAB_TYPE));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string | undefined>).detail;
      if (!detail || !validTabs.has(detail)) return;
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.settingsInitialTab);
      setActiveTab(detail as TabType);
    };
    window.addEventListener(WINDOW_EVENTS.settingsSetTab, handler as EventListener);
    return () => window.removeEventListener(WINDOW_EVENTS.settingsSetTab, handler as EventListener);
  }, []);

  const { agents } = useSettingsData();

  const [advancedMode, setAdvancedMode] = useState(() =>
    localStorage.getItem(LOCAL_STORAGE_KEYS.advancedMode) === 'true'
  );

  const handleAdvancedModeToggle = (value: boolean) => {
    setAdvancedMode(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.advancedMode, String(value));
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_KEYS.advancedMode, newValue: String(value) }));
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    // Sync system tray menu language
    if (isTauri()) {
      invoke('update_tray_language', { lang: lng }).catch(() => {});
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: TAB_TYPE.General, label: t('settings.tabGeneral'), icon: 'tune' },
    { id: TAB_TYPE.Advanced, label: t('settings.tabAdvanced'), icon: 'build' },
    { id: TAB_TYPE.Agents, label: t('settings.tabAgents'), icon: 'smart_toy' },
    { id: TAB_TYPE.About, label: t('settings.tabAbout'), icon: 'info' },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon="settings"
        title={t('header.settings')}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => open(GITHUB_URLS.RELEASES)}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              title={t('settings.tabChangelog')}
            >
              <span className="material-symbols-outlined material-symbols-legacy text-lg text-slate-500 dark:text-gray-400">update</span>
              <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
                {t('settings.tabChangelog')}
              </span>
            </button>
            <button
              onClick={() => open(GITHUB_URLS.ISSUES)}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              title={t('settings.feedback')}
            >
              <span className="material-symbols-outlined material-symbols-legacy text-lg text-slate-500 dark:text-gray-400">chat</span>
              <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
                {t('settings.feedback')}
              </span>
            </button>
            {/* <a
              href={GITHUB_URLS.REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-[#f8f9fa] dark:hover:bg-dark-bg-tertiary rounded-full p-2 text-slate-500 dark:text-gray-300 transition-colors flex items-center justify-center"
              title="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a> */}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary">
        <div className="p-8 space-y-6">
          {/* Tabs */}
          <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-2 shadow-sm border border-[#e1e3e4] dark:border-dark-border mb-6 flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#b71422] text-white shadow-md'
                    : 'text-slate-600 dark:text-gray-300 hover:bg-[#f8f9fa] dark:hover:bg-dark-bg-tertiary'
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === TAB_TYPE.General && (
              <>
                <LanguageSection
                  currentLanguage={i18n.language}
                  onLanguageChange={handleLanguageChange}
                />
                <AppearanceSection
                  currentTheme={theme}
                  onThemeChange={handleThemeChange}
                />
              </>
            )}

            {activeTab === TAB_TYPE.Advanced && (
              <>
                <AdvancedSection
                  advancedMode={advancedMode}
                  onToggle={handleAdvancedModeToggle}
                />
                <SkillFilterSection />
              </>
            )}

            {activeTab === TAB_TYPE.Agents && <AgentsSection agents={agents} />}

            {activeTab === TAB_TYPE.About && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
