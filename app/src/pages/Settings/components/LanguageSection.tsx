import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../constants/config';

import { Icon } from '@/components/Icon';
interface LanguageSectionProps {
  currentLanguage: string;
  onLanguageChange: (lng: string) => void;
}

export const LanguageSection: React.FC<LanguageSectionProps> = ({
  currentLanguage,
  onLanguageChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-5 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon name="language" className="text-2xl text-slate-600 dark:text-gray-300" />
          {t('settings.language')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          {t('settings.languageDescription')}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              currentLanguage === lang.code
                ? 'border-[#b71422] bg-[#b71422]/5 dark:bg-[#b71422]/10'
                : 'border-[#e1e3e4] dark:border-dark-border hover:border-[#b71422]/30 bg-white dark:bg-dark-bg-card'
            }`}
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium ${
              currentLanguage === lang.code
                ? 'bg-[#b71422] text-white'
                : 'bg-slate-100 dark:bg-dark-bg-tertiary text-slate-600 dark:text-gray-300'
            }`}>
              {lang.abbr}
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-white">
              {lang.name}
            </span>
            {currentLanguage === lang.code && (
              <Icon name="check_circle" className="text-[#b71422] ml-auto" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
