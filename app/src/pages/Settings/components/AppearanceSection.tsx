import { useTranslation } from 'react-i18next';
import { THEME_OPTIONS, type Theme } from '../constants/config';

interface AppearanceSectionProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-6 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">palette</span>
          {t('settings.appearance')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          {t('settings.appearanceDescription')}
        </p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">
          {t('settings.theme')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => onThemeChange(themeOption.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                currentTheme === themeOption.value
                  ? 'border-[#b71422] bg-[#b71422]/5 dark:bg-[#b71422]/10'
                  : 'border-[#e1e3e4] dark:border-dark-border hover:border-[#b71422]/30 bg-white dark:bg-dark-bg-card'
              }`}
            >
              <span className="material-symbols-outlined text-3xl text-slate-600 dark:text-gray-300">
                {themeOption.icon}
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-white">
                {t(themeOption.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
