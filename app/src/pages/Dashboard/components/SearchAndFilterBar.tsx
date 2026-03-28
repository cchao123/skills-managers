import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../../components/Toast';
import { StatsBar } from './StatsBar';
import { getAgentIcon } from '../utils/agentHelpers';
import type { SkillMetadata, AgentConfig } from '../../../types';

interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'enabled' | 'disabled';
  onFilterChange: (type: 'all' | 'enabled' | 'disabled') => void;
  skills: SkillMetadata[];
  viewMode: 'flat' | 'agent';
  selectedAgent: string;
  onAgentSelect: (agent: string) => void;
  agents: AgentConfig[];
}

export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  skills,
  viewMode,
  selectedAgent,
  onAgentSelect,
  agents,
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
          className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
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
        <>
          {/* Agent Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {agents.filter(a => a.detected).map((agent) => {
              return (
                <button
                  key={agent.name}
                  onClick={() => onAgentSelect(agent.name)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedAgent === agent.name
                      ? 'bg-[#b71422] text-white font-bold'
                      : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <img
                      src={getAgentIcon(agent.name)}
                      alt={agent.display_name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span>{agent.display_name}</span>
                </button>
              );
            })}
            <button
              onClick={() => onAgentSelect('All')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedAgent === 'All'
                  ? 'bg-[#b71422] text-white font-bold'
                  : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
              }`}
            >
              <span className="text-base">🐙</span>
              <span>全部</span>
            </button>
          </div>
        </>
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
