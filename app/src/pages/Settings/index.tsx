import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsData } from './hooks/useSettingsData';
import { DEFAULT_TAB, TAB_TYPE, type TabType, type Theme } from './constants/config';
import { LanguageSection } from './components/LanguageSection';
import { AppearanceSection } from './components/AppearanceSection';
import { SearchBarSection } from './components/SearchBarSection';
import { AgentsSection } from './components/AgentsSection';
import { SkillFilterSection } from './components/SkillFilterSection';
import { AboutSection } from './components/AboutSection';
import { AdvancedSection } from './components/AdvancedSection';
import { PreviewLockedSection } from './components/PreviewLockedSection';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri-env';
import { isPreview } from '@/lib/preview-env';
import { SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, WINDOW_EVENTS } from '@/constants';

import { Icon } from '@/components/Icon';
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
      {/* Tab bar - fixed outside scroll container */}
      <div className="flex-shrink-0 px-8 pt-4 pb-3 bg-[#f8f9fa] dark:bg-dark-bg-secondary" data-tauri-drag-region>
        <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-2 shadow-sm border border-[#e1e3e4] dark:border-dark-border flex gap-2">
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
              <Icon name={tab.icon} className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary flex flex-col">
        {activeTab === TAB_TYPE.About ? (
          <div className="flex-1 p-8 flex flex-col">
            <AboutSection />
          </div>
        ) : (
          <div className="px-8 pt-3 pb-8 space-y-6">
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
                <SearchBarSection />
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

            {activeTab === TAB_TYPE.Agents && (
              isPreview() ? (
                <PreviewLockedSection feature="agents" />
              ) : (
                <AgentsSection agents={agents} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
