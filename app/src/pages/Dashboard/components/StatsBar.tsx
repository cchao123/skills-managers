import { useTranslation } from 'react-i18next';
import type { SkillMetadata } from '@/types';
import { FILTER_TYPE, type FilterType } from '@/pages/Dashboard/constants/filterType';

interface StatsBarProps {
  skills: SkillMetadata[];
  filterType: FilterType;
  onFilterChange: (type: FilterType) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({ skills, filterType, onFilterChange }) => {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 px-2 py-2 bg-[#f8f9fa] dark:bg-black rounded-lg border border-[#e1e3e4] dark:border-dark-border">
      <button
        type="button"
        onClick={() => onFilterChange(FILTER_TYPE.All)}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === FILTER_TYPE.All
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
        <div
          className={`text-xs font-bold transition-colors ${
            filterType === FILTER_TYPE.All
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-gray-300'
          }`}
        >
          <span className="text-sm">{skills.length}</span> {t('dashboard.stats.total')}
        </div>
      </button>
      <div className="w-px h-3 bg-slate-300 dark:bg-dark-bg-tertiary"></div>
      <button
        type="button"
        onClick={() => onFilterChange(FILTER_TYPE.Enabled)}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === FILTER_TYPE.Enabled
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
        <div
          className={`text-xs font-bold transition-colors ${
            filterType === FILTER_TYPE.Enabled
              ? 'text-green-600 dark:text-green-400'
              : 'text-slate-600 dark:text-gray-300'
          }`}
        >
          <span className="text-sm">{skills.filter((s) => s.enabled).length}</span> {t('dashboard.stats.enabled')}
        </div>
      </button>
      <div className="w-px h-3 bg-slate-300 dark:bg-dark-bg-tertiary"></div>
      <button
        type="button"
        onClick={() => onFilterChange(FILTER_TYPE.Disabled)}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === FILTER_TYPE.Disabled
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
        <div
          className={`text-xs font-bold transition-colors ${
            filterType === FILTER_TYPE.Disabled
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-600 dark:text-gray-300'
          }`}
        >
          <span className="text-sm">{skills.filter((s) => !s.enabled).length}</span> {t('dashboard.stats.disabled')}
        </div>
      </button>
    </div>
  );
};
