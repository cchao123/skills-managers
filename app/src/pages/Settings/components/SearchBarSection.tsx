import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useSearchBarPrefs, type SearchBarPrefs } from '@/hooks/useSearchBarPrefs';

const DEFAULT_ITEMS: Array<{ key: keyof SearchBarPrefs; icon: string; labelKey: string; hintKey: string }> = [
  { key: 'showFilter', icon: 'filter_alt_off', labelKey: 'settings.searchBar.showFilter', hintKey: 'settings.searchBar.showFilterHint' },
  { key: 'showActions', icon: 'help', labelKey: 'settings.searchBar.showActions', hintKey: 'settings.searchBar.showActionsHint' },
];

export const SearchBarSection: React.FC = () => {
  const { t } = useTranslation();
  const { prefs, setPref, resetPrefs } = useSearchBarPrefs();

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-6 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="search" className="text-2xl text-slate-600 dark:text-gray-300" />
            {t('settings.searchBar.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {t('settings.searchBar.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetPrefs()}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-dark-bg-tertiary"
        >
          {t('settings.searchBar.reset')}
        </button>
      </div>

      <div className="space-y-3">
        {DEFAULT_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPref(item.key, !prefs[item.key])}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left border-[#e1e3e4] dark:border-dark-border hover:border-[#b71422]/30 bg-white dark:bg-dark-bg-card"
          >
            <span className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center ${
              prefs[item.key] ? 'bg-[#b71422] text-white' : 'bg-slate-100 text-slate-500 dark:bg-dark-bg-tertiary dark:text-gray-400'
            }`}>
              <Icon name={item.icon} className="text-xl" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-700 dark:text-white">{t(item.labelKey)}</span>
              <span className="block text-xs text-slate-500 dark:text-gray-400 mt-0.5">{t(item.hintKey)}</span>
            </span>
            <span
              role="switch"
              aria-checked={prefs[item.key]}
              className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                prefs[item.key] ? 'bg-[#b71422]' : 'bg-slate-300 dark:bg-dark-bg-tertiary'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                prefs[item.key] ? 'translate-x-[18px]' : 'translate-x-[2px]'
              }`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
