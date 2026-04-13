import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/components/Toast';
import { StatsBar } from '@/pages/Dashboard/components/StatsBar';
import { getAgentIcon } from '@/pages/Dashboard/utils/agentHelpers';
import octopusIcon from '@/assets/agents/octopus.svg';
import type { SkillMetadata } from '@/types';

interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'enabled' | 'disabled';
  onFilterChange: (type: 'all' | 'enabled' | 'disabled') => void;
  skills: SkillMetadata[];
  viewMode: 'flat' | 'agent';
  selectedSource: string;
  onSourceSelect: (source: string) => void;
}

export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  skills,
  viewMode,
  selectedSource,
  onSourceSelect,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

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

      {viewMode === 'flat' && (
        <>
          {/* Stats Bar */}
          <StatsBar skills={skills} filterType={filterType} onFilterChange={onFilterChange} />
        </>
      )}

      {viewMode === 'agent' && (
        <div className="flex flex-wrap items-center gap-2 h-[50px]">
          {[
            { id: 'global', label: 'Skills Manager根目录', icon: octopusIcon },
            { id: 'claude', label: 'Claude Code', icon: getAgentIcon('claude') },
            { id: 'cursor', label: 'Cursor', icon: getAgentIcon('cursor') },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onSourceSelect(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedSource === item.id
                  ? 'bg-[#b71422] text-white font-bold'
                  : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
              }`}
            >
              {item.icon ? (
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <img src={item.icon} alt={item.label} className="w-full h-full object-contain" />
                </div>
              ) : (
                <span className="material-symbols-outlined text-base">inventory_2</span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Open Skills Folder */}
      <button
        onClick={() => {
          invoke('open_skills_manager_folder').catch((err: unknown) => {
            console.error('Failed to open folder:', err);
            showToast('error', '打开文件夹失败');
          });
        }}
        className="flex items-center gap-1.5 bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary hover:border-[#b71422]/30 transition-all shadow-sm"
        title="打开技能文件夹"
      >
        <span className="material-symbols-outlined text-lg">folder_open</span>
      </button>
    </div>
  );
};
