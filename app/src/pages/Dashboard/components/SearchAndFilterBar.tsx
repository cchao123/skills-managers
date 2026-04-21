import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsBar } from '@/pages/Dashboard/components/StatsBar';
import { SourceTabs } from '@/pages/Dashboard/components/SourceTabs';
import { VIEW_MODE, type ViewMode } from '@/pages/Dashboard/constants/viewMode';
import type { FilterType } from '@/pages/Dashboard/constants/filterType';
import type { SkillMetadata, AgentConfig } from '@/types';
import { useSkillHidePrefixes } from '@/hooks/useSkillHidePrefixes';

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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { prefixes, addPrefix, removePrefix } = useSkillHidePrefixes();

  // Esc 关闭弹窗：仅在打开时挂 window 级 keydown 监听，避免常驻全局监听器
  useEffect(() => {
    if (!isFilterModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsFilterModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFilterModalOpen]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setIsFilterModalOpen(true)}
        className="relative hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors"
        title={t('settings.skillFilter.title')}
      >
        <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">
          filter_alt_off
        </span>
        {prefixes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center font-semibold">
            {prefixes.length}
          </span>
        )}
      </button>
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

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={() => setIsFilterModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">
                    filter_alt_off
                  </span>
                  {t('settings.skillFilter.title')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {t('settings.skillFilter.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <FilterModalContent
              prefixes={prefixes}
              addPrefix={addPrefix}
              removePrefix={removePrefix}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Modal Content Component
interface FilterModalContentProps {
  prefixes: string[];
  addPrefix: (prefix: string) => void;
  removePrefix: (prefix: string) => void;
}

const FilterModalContent: React.FC<FilterModalContentProps> = ({
  prefixes,
  addPrefix,
  removePrefix,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addPrefix(trimmed);
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && prefixes.length > 0) {
      removePrefix(prefixes[prefixes.length - 1]);
    }
  };

  return (
    <div className="px-6 py-5 space-y-4">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400">
            add
          </span>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.skillFilter.placeholder')}
            className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-2.5 pl-12 pr-4 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-[#b71422] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('settings.skillFilter.add')}
        </button>
      </div>

      {/* Chip list */}
      {prefixes.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-gray-500 italic">
          {t('settings.skillFilter.empty')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {prefixes.map((prefix) => (
            <span
              key={prefix}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono font-semibold"
            >
              {prefix}
              <button
                type="button"
                onClick={() => removePrefix(prefix)}
                aria-label={t('settings.skillFilter.remove', { prefix })}
                title={t('settings.skillFilter.remove', { prefix })}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-gray-500 leading-relaxed">
        {t('settings.skillFilter.hint')}
      </p>
    </div>
  );
};
