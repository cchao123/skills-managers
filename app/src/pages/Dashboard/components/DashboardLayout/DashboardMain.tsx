import React, { useMemo, useRef, useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentConfig, SkillMetadata } from '@/types';
import { SearchAndFilterBar } from '@/pages/Dashboard/components/SearchAndFilterBar';
import { EmptyView } from '@/pages/Dashboard/components/EmptyView';
import { SkillCard } from '@/pages/Dashboard/components/SkillCard';
import { DragDropOverlay } from '@/pages/Dashboard/components/DragDropOverlay';
import { ImportingOverlay } from '@/pages/Dashboard/components/ImportingOverlay';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { getAgentRootPath } from '@/constants';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { agentsApi } from '@/api/tauri';
import { Icon } from '@/components/Icon';
import type { ReactNode } from 'react';

interface DashboardMainProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterType: string;
  onFilterChange: (type: string | ((prev: string) => string)) => void;
  prefixFilteredSkills: SkillMetadata[];
  agents: AgentConfig[];
  selectedSource: string;
  filteredBySource: SkillMetadata[];
  expandedCards: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSkill: (skill: SkillMetadata) => void;
  onToggleAgent: (skill: Metadata, agent: string) => void;
  onShowDetail: (skill: SkillMetadata) => void;
  pinnedIds: Set<string>;
  onContextMenu: (skillId: string, e: React.MouseEvent<HTMLElement>) => void;
  onOpenImportModal: () => void;
  isDragOver: boolean;
  importing: boolean;
  sidebar: ReactNode;
  showDetailModal: boolean;
  skills: SkillMetadata[];
  detailSkill: SkillMetadata | null;
  onMainScroll?: () => void;
}

export const DashboardMain: React.FC<DashboardMainProps> = memo(({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  prefixFilteredSkills,
  agents,
  selectedSource,
  filteredBySource,
  expandedCards,
  onToggleExpand,
  onToggleSkill,
  onToggleAgent,
  onShowDetail,
  pinnedIds,
  onContextMenu,
  onOpenImportModal,
  isDragOver,
  importing,
  sidebar,
  showDetailModal,
  skills,
  detailSkill,
  onMainScroll,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      {/* 搜索栏 - 固定；overflow-visible 供统计条 hover 气泡向上伸出 */}
      <div
        className="overflow-visible bg-[#f8f9fa] dark:bg-dark-bg-secondary pr-5 pt-5 pb-4"
        data-tauri-drag-region
      >
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          filterType={filterType as any}
          onFilterChange={onFilterChange as any}
          skills={prefixFilteredSkills}
          compact={showDetailModal}
        />
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className="relative flex-1 flex overflow-hidden bg-[#f8f9fa] dark:bg-dark-bg-secondary px-5 pl-0">
        {sidebar}
        <div onScroll={onMainScroll} className={`relative flex-1 overflow-y-auto pb-20 ${isDragOver ? 'border-4 border-[#b71422] bg-white/90 dark:bg-dark-bg-primary rounded-xl' : ''}`}>
          {/* 当前扫描路径 */}
          {selectedSource && selectedSource !== SOURCE.All && (
            <div className="flex items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-2">
                {selectedSource === SOURCE.Global ? (
                  <>
                    <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs text-[#5e5e5e] dark:text-gray-400">
                      {t('dashboard.rootPathLabel')}
                      <span
                        className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline font-mono"
                        onClick={() => agentsApi.openFolderPath('~/.skills-manager').catch(() => { })}
                      >~/.skills-manager</span>
                    </p>
                  </>
                ) : (
                  (() => {
                    const path = getAgentRootPath(selectedSource);
                    const icon = getAgentIcon(selectedSource);
                    return (
                      <>
                        {icon ? (
                          <img src={icon} alt="" className={`w-4 h-4 flex-shrink-0 ${needsInvertInDark(selectedSource) ? 'dark:invert' : ''}`} />
                        ) : (
                          <Icon name="folder_open" className="text-base text-gray-500 dark:text-gray-400" />
                        )}
                        <p className="text-xs text-[#5e5e5e] dark:text-gray-400">
                          {t('dashboard.agentSourcePath')}
                          {path ? (
                            <span
                              className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline font-mono"
                              onClick={() => agentsApi.openFolderPath(path).catch(() => { })}
                            >{path}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500">未配置扫描路径</span>
                          )}
                        </p>
                      </>
                    );
                  })()
                )}
              </div>

              {/* 从已有Agent导入 */}
              <button
                onClick={onOpenImportModal}
                className="text-[11px] text-slate-700 dark:text-slate-300 font-medium px-2 py-1 bg-white dark:bg-slate-800 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex-shrink-0 flex items-center gap-1.5"
              >
                <Icon name="download" size={12} />
                从已有Agent导入
              </button>
            </div>
          )}

          {filteredBySource.length === 0 ? (
            <EmptyView
              message={searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')}
              searchTerm={searchTerm}
              filterType={filterType}
              selectedSource={selectedSource}
            />
          ) : (
            <SkillGrid
              skills={filteredBySource}
              agents={agents}
              expandedCards={expandedCards}
              pinnedIds={pinnedIds}
              selectedSource={selectedSource}
              onToggleExpand={onToggleExpand}
              onToggleSkill={onToggleSkill}
              onToggleAgent={onToggleAgent}
              onShowDetail={onShowDetail}
              onContextMenu={onContextMenu}
              onOpenImportModal={onOpenImportModal}
              showDetailModal={showDetailModal}
              detailSkill={detailSkill}
            />
          )}

          {/* Drag & Drop Overlay */}
          {isDragOver && <DragDropOverlay selectedSource={selectedSource} />}
        </div>

        {/* Importing Overlay */}
        {importing && <ImportingOverlay />}
      </div>
    </div>
  );
});

interface SkillGridProps {
  skills: SkillMetadata[];
  agents: AgentConfig[];
  expandedCards: Set<string>;
  pinnedIds: Set<string>;
  selectedSource: string;
  onToggleExpand: (id: string) => void;
  onToggleSkill: (skill: SkillMetadata) => void;
  onToggleAgent: (skill: SkillMetadata, agent: string) => void;
  onShowDetail: (skill: SkillMetadata) => void;
  onContextMenu: (skillId: string, e: React.MouseEvent<HTMLElement>) => void;
  onOpenImportModal: () => void;
  showDetailModal: boolean;
  detailSkill: SkillMetadata | null;
}

const SkillGrid: React.FC<SkillGridProps> = ({
  skills,
  agents,
  expandedCards,
  pinnedIds,
  selectedSource,
  onToggleExpand,
  onToggleSkill,
  onToggleAgent,
  onShowDetail,
  onContextMenu,
  onOpenImportModal,
  showDetailModal,
  detailSkill,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId: number | undefined;
    const ro = new ResizeObserver(entries => {
      // rAF 节流：每帧最多更新一次，防止面板动画和滚动条出现时的高频触发导致卡顿
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setContainerWidth(entries[0].contentRect.width);
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, []);

  // 基于容器实际宽度计算列数，天然响应详情面板开合
  const numCols = useMemo(() => {
    if (containerWidth < 600) return 1;
    if (containerWidth < 960) return 2;
    if (containerWidth < 1280) return 3;
    return 4;
  }, [containerWidth]);

  // 按行序分配到各列：item i → 第 (i % numCols) 列
  // 保留瀑布流（各列高度独立），同时修正横向阅读顺序为 1,2,3,4,5…
  const columns = useMemo(() => {
    const cols: SkillMetadata[][] = Array.from({ length: numCols }, () => []);
    skills.forEach((skill, i) => { cols[i % numCols].push(skill); });
    return cols;
  }, [skills, numCols]);

  return (
    <div ref={containerRef} className="flex gap-4 items-start">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-4 min-w-0">
          {col.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              agents={agents}
              expanded={expandedCards.has(skill.id)}
              onToggleExpand={onToggleExpand}
              onToggleSkill={onToggleSkill}
              onToggleAgent={onToggleAgent}
              onShowDetail={onShowDetail}
              pinned={pinnedIds.has(skill.id)}
              onContextMenu={onContextMenu}
              isSelected={detailSkill?.id === skill.id}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

