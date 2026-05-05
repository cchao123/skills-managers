import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsBar } from '@/pages/Dashboard/components/StatsBar';
import { SourceTabs } from '@/pages/Dashboard/components/SourceTabs';
import { AgentFilterButton } from '@/pages/Dashboard/components/AgentFilterButton';
import { VIEW_MODE, VIEW_MODE_SHORTCUT_KEY, type ViewMode } from '@/pages/Dashboard/constants/viewMode';
import type { FilterType } from '@/pages/Dashboard/constants/filterType';
import type { SkillMetadata, AgentConfig } from '@/types';
import { useSkillHidePrefixes, matchesAnyPrefix } from '@/hooks/useSkillHidePrefixes';
import { useSearchBarPrefs } from '@/hooks/useSearchBarPrefs';
import { useDetectedAgents } from '@/pages/Dashboard/hooks/useDetectedAgents';

import { Icon } from '@/components/Icon';
interface SearchAndFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: FilterType;
  onFilterChange: (type: FilterType) => void;
  skills: SkillMetadata[];
  agents: AgentConfig[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedSource: string;
  onSourceSelect: (source: string) => void;
  /** 平铺视图下「按 Agent 快筛」当前选中项；'' 表示不筛 */
  agentFilter: string;
  /** 切换快筛选中项 */
  onAgentFilterChange: (value: string) => void;
  /** 渲染在搜索栏最右侧的额外操作（如操作日志、帮助按钮等） */
  rightActions?: React.ReactNode;
}

export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  skills,
  agents,
  viewMode,
  onViewModeChange,
  selectedSource,
  onSourceSelect,
  agentFilter,
  onAgentFilterChange,
  rightActions,
}) => {
  const { t } = useTranslation();
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const { prefixes, addPrefix, removePrefix } = useSkillHidePrefixes();
  const { prefs: searchBarPrefs } = useSearchBarPrefs();
  const detectedAgents = useDetectedAgents(agents);

  // 检测操作系统以显示正确的快捷键
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘' : 'Ctrl';

  // 隐藏搜索框时同时清空已输入的关键字，避免出现"看不到输入但仍在过滤"的隐式状态
  useEffect(() => {
    if (!searchBarPrefs.showSearch && searchTerm) {
      onSearchChange('');
    }
  }, [searchBarPrefs.showSearch, searchTerm, onSearchChange]);

  // Esc / 点击外部 关闭下拉
  useEffect(() => {
    if (!isFilterDropdownOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsFilterDropdownOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [isFilterDropdownOpen]);

  const isFlatView = viewMode === VIEW_MODE.Flat;

  const switchView = (mode: ViewMode) => {
    if (mode === viewMode) return;
    onViewModeChange(mode);
  };

  return (
    <div className="flex items-center gap-3 h-11" data-tauri-drag-region>
      <div className="relative">
        {/* 滑块式视图切换 */}
        <div className="relative grid grid-cols-2 items-center rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-slate-100 dark:bg-dark-bg-tertiary p-0.5 h-9">
          {/* 滑动高亮块 */}
          <div
            className={`absolute top-0.5 bottom-0.5 rounded-md bg-white dark:bg-dark-bg-card shadow-sm transition-all duration-200 ease-in-out ${
              isFlatView ? 'left-0.5 right-1/2' : 'left-1/2 right-0.5'
            }`}
          />
          <div className="relative z-50 group">
            <button
              onClick={() => switchView(VIEW_MODE.Flat)}
              className="flex items-center justify-center w-full h-full gap-1.5 px-3 rounded-md transition-colors"
              aria-pressed={isFlatView}
            >
              <Icon name="grid_view" className={`text-xl transition-colors ${isFlatView ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`} />
              <span className={`text-xs font-medium whitespace-nowrap transition-colors ${isFlatView ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>{t('dashboard.viewFlat')}</span>
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[9999] pointer-events-none hidden group-hover:block">
              <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
                {t('dashboard.viewFlat')} {shortcutKey}{VIEW_MODE_SHORTCUT_KEY[VIEW_MODE.Flat]}
              </div>
            </div>
          </div>
          <div className="relative z-50 group">
            <button
              onClick={() => switchView(VIEW_MODE.Agent)}
              className="flex items-center justify-center w-full h-full gap-1.5 px-3 rounded-md transition-colors"
              aria-pressed={!isFlatView}
            >
              <Icon name="smart_toy" className={`text-xl transition-colors ${!isFlatView ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`} />
              <span className={`text-xs font-medium whitespace-nowrap transition-colors ${!isFlatView ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>{t('dashboard.viewBySource')}</span>
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[9999] pointer-events-none hidden group-hover:block">
              <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
                {t('dashboard.viewBySource')} {shortcutKey}{VIEW_MODE_SHORTCUT_KEY[VIEW_MODE.Agent]}
              </div>
            </div>
          </div>
        </div>
      </div>
      {searchBarPrefs.showSearch && (
        <div ref={filterDropdownRef} className="relative w-64 shrink-0">
          <div className={`flex items-center h-9 rounded-lg border transition-colors focus-within:border-[#b71422] bg-white dark:bg-dark-bg-card overflow-hidden ${
            searchTerm ? 'border-[#b71422]/40 dark:border-[#fca5a5]/40' : 'border-[#e1e3e4] dark:border-dark-border'
          }`}>
            {searchBarPrefs.showFilter && (
              <button
                onClick={() => setIsFilterDropdownOpen((v) => !v)}
                className={`relative flex-shrink-0 self-stretch px-2 flex items-center border-r border-[#e1e3e4] dark:border-dark-border transition-colors ${
                  isFilterDropdownOpen
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'
                    : 'bg-slate-50 dark:bg-dark-bg-tertiary hover:bg-slate-100 dark:hover:bg-dark-bg-secondary text-slate-400 hover:text-slate-600 dark:hover:text-gray-200'
                }`}
                title={t('settings.skillFilter.title')}
              >
                <Icon name="filter_alt_off" className="text-xl" />
                {prefixes.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full text-[7px] text-white flex items-center justify-center font-semibold leading-none">
                    {prefixes.length}
                  </span>
                )}
              </button>
            )}
            <Icon name="search" className={`flex-shrink-0 text-slate-400 dark:text-gray-400 ${searchBarPrefs.showFilter ? 'ml-2.5' : 'ml-3'}`} />
            <input
              type="text"
              placeholder={t('dashboard.search.placeholder')}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`flex-1 h-full bg-transparent border-0 outline-none ring-0 focus:ring-0 pl-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 ${searchTerm ? 'pr-7' : 'pr-3'}`}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-dark-bg-tertiary transition-colors flex-shrink-0"
                title={t('dashboard.search.clear')}
              >
                <Icon name="close" className="text-slate-400 dark:text-gray-500 text-sm" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          {isFilterDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-96 bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border shadow-xl z-50 overflow-hidden animate-toast-in">
              <div className="px-4 py-3 border-b border-[#e1e3e4] dark:border-dark-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Icon name="filter_alt_off" className="text-base text-slate-500 dark:text-gray-300" />
                  {t('settings.skillFilter.title')}
                </h3>
                <button
                  onClick={() => setIsFilterDropdownOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
                >
                  <Icon name="close" className="text-base" />
                </button>
              </div>
              <FilterDropdownContent
                prefixes={prefixes}
                addPrefix={addPrefix}
                removePrefix={removePrefix}
                skills={skills}
              />
            </div>
          )}
        </div>
      )}

      {viewMode === VIEW_MODE.Flat && (
        <>
          <AgentFilterButton
            agents={detectedAgents}
            selected={agentFilter}
            onSelect={onAgentFilterChange}
          />
          <div className="shrink-0 ml-auto">
            <StatsBar skills={skills} filterType={filterType} onFilterChange={onFilterChange} />
          </div>
        </>
      )}

      {viewMode === VIEW_MODE.Agent && (
        <div className="ml-auto shrink-0">
          <SourceTabs
            agents={agents}
            selectedSource={selectedSource}
            onSelect={onSourceSelect}
          />
        </div>
      )}

      {searchBarPrefs.showActions && rightActions && (
        <div className="flex items-center gap-1 shrink-0">{rightActions}</div>
      )}

    </div>
  );
};

// Filter Dropdown Content Component
interface FilterDropdownContentProps {
  prefixes: string[];
  addPrefix: (prefix: string) => void;
  removePrefix: (prefix: string) => void;
  skills: SkillMetadata[];
}

const FilterDropdownContent: React.FC<FilterDropdownContentProps> = ({
  prefixes,
  addPrefix,
  removePrefix,
  skills,
}) => {
  const { t } = useTranslation();
  const visibleCount = skills.filter((s) => !matchesAnyPrefix(s.name, prefixes)).length;
  const isPartial = prefixes.length > 0 && visibleCount < skills.length;
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
    <div className="px-4 py-3 space-y-3">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="add" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400 text-base" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.skillFilter.placeholder')}
            className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-lg py-2 pl-9 pr-3 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all"
          />
        </div>
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg text-sm font-bold bg-[#b71422] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="flex flex-wrap gap-1.5">
          {prefixes.map((prefix) => (
            <span
              key={prefix}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono font-semibold"
            >
              {prefix}
              <button
                type="button"
                onClick={() => removePrefix(prefix)}
                aria-label={t('settings.skillFilter.remove', { prefix })}
                title={t('settings.skillFilter.remove', { prefix })}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
              >
                <Icon name="close" className="text-[11px]" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-gray-500 leading-relaxed">
          {t('settings.skillFilter.hint')}
        </p>
      </div>
    </div>
  );
};
