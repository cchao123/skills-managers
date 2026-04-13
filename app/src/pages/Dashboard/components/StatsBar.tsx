import { useTranslation } from 'react-i18next';
import type { SkillMetadata } from '@/types';

interface StatsBarProps {
  skills: SkillMetadata[];
  filterType: 'all' | 'enabled' | 'disabled';
  onFilterChange: (type: 'all' | 'enabled' | 'disabled') => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({ skills, filterType, onFilterChange }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-3 px-2 py-2 bg-[#f8f9fa] dark:bg-dark-bg-secondary rounded-lg border border-[#e1e3e4] dark:border-dark-border">
      <button
        onClick={() => onFilterChange('all')}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === 'all'
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
        <div className={`text-xs font-bold transition-colors ${
          filterType === 'all'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-600 dark:text-gray-300'
        }`}>
          <span className="text-sm">{skills.length}</span> {t('dashboard.stats.total')}
        </div>
      </button>
      <div className="w-px h-3 bg-slate-300 dark:bg-dark-bg-tertiary"></div>
      <button
        onClick={() => onFilterChange('enabled')}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === 'enabled'
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
        <div className={`text-xs font-bold transition-colors ${
          filterType === 'enabled'
            ? 'text-green-600 dark:text-green-400'
            : 'text-slate-600 dark:text-gray-300'
        }`}>
          <span className="text-sm">{skills.filter(s => s.enabled).length}</span> {t('dashboard.stats.enabled')}
        </div>
      </button>
      <div className="w-px h-3 bg-slate-300 dark:bg-dark-bg-tertiary"></div>
      <button
        onClick={() => onFilterChange('disabled')}
        className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 ${
          filterType === 'disabled'
            ? 'bg-white dark:bg-dark-bg-card shadow-sm'
            : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
        <div className={`text-xs font-bold transition-colors ${
          filterType === 'disabled'
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-600 dark:text-gray-300'
        }`}>
          <span className="text-sm">{skills.filter(s => !s.enabled).length}</span> {t('dashboard.stats.disabled')}
        </div>
      </button>
    </div>
  );
};
