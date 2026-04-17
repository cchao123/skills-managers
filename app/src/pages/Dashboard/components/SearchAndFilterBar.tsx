import { useTranslation } from 'react-i18next';
import { StatsBar } from '@/pages/Dashboard/components/StatsBar';
import { SourceTabs } from '@/pages/Dashboard/components/SourceTabs';
import { VIEW_MODE, type ViewMode } from '@/pages/Dashboard/constants/viewMode';
import type { FilterType } from '@/pages/Dashboard/constants/filterType';
import type { SkillMetadata, AgentConfig } from '@/types';

interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: FilterType;
  onFilterChange: (type: FilterType) => void;
  skills: SkillMetadata[];
  agents: AgentConfig[];
  viewMode: ViewMode;
  selectedSource: string;
  onSourceSelect: (source: string) => void;
}

export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  skills,
  agents,
  viewMode,
  selectedSource,
  onSourceSelect,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      {/* Search Box */}
      <div className="relative flex-1">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400">
          search
        </span>
        <input
          type="text"
          placeholder={t('dashboard.search.placeholder')}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-2.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {viewMode === VIEW_MODE.Flat && (
        <div className="shrink-0">
          <StatsBar skills={skills} filterType={filterType} onFilterChange={onFilterChange} />
        </div>
      )}

      {viewMode === VIEW_MODE.Agent && (
        <SourceTabs
          agents={agents}
          selectedSource={selectedSource}
          onSelect={onSourceSelect}
        />
      )}
    </div>
  );
};
