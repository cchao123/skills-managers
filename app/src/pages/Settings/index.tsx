import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import PageHeader from '../../components/PageHeader';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettingsData } from './hooks/useSettingsData';
import { GITHUB_URLS, DEFAULT_TAB, type TabType, type Theme } from './constants/config';
import { LanguageSection } from './components/LanguageSection';
import { AppearanceSection } from './components/AppearanceSection';
import { AgentsSection } from './components/AgentsSection';
import { LinkingStrategySection } from './components/LinkingStrategySection';
import { ActionsSection } from './components/ActionsSection';
import { AboutSection } from './components/AboutSection';

function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>(DEFAULT_TAB);

  const {
    agents,
    linkingStrategy,
    handleDetectAgents,
    handleSetStrategy,
    handleOpenFolder,
  } = useSettingsData();

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    // Sync system tray menu language
    if ((window as any).__TAURI__) {
      (window as any).__TAURI__.invoke('update_tray_language', { lang: lng }).catch(() => {});
    }
  };

  const tabs = [
    { id: 'general' as TabType, label: t('settings.tabGeneral'), icon: 'tune' },
    { id: 'agents' as TabType, label: 'Agents', icon: 'smart_toy' },
    { id: 'about' as TabType, label: t('settings.tabAbout'), icon: 'info' },
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
              className="hover:bg-[#f8f9fa] dark:hover:bg-dark-bg-tertiary rounded-xl px-3 py-2 text-slate-500 dark:text-gray-300 transition-colors flex items-center gap-1.5 text-sm font-medium cursor-pointer"
              title={t('settings.tabChangelog')}
            >
              <span className="material-symbols-outlined text-lg">update</span>
              {t('settings.tabChangelog')}
            </button>
            <a
              href={GITHUB_URLS.REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-[#f8f9fa] dark:hover:bg-dark-bg-tertiary rounded-full p-2 text-slate-500 dark:text-gray-300 transition-colors flex items-center justify-center"
              title="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
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
            {activeTab === 'general' && (
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

            {activeTab === 'agents' && (
              <div className="space-y-6">
                <AgentsSection
                  agents={agents}
                  onDetectAgents={handleDetectAgents}
                />
                <LinkingStrategySection
                  currentStrategy={linkingStrategy}
                  onStrategyChange={handleSetStrategy}
                />
                <ActionsSection
                  onOpenFolder={handleOpenFolder}
                />
              </div>
            )}

            {activeTab === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
