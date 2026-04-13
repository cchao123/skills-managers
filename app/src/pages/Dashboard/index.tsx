import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import type { SkillMetadata } from '@/types';
import { TabSwitcher } from '@/components/TabSwitcher';

// Hooks
import { useSkillData } from '@/pages/Dashboard/hooks/useSkillData';
import { useSkillFilters } from '@/pages/Dashboard/hooks/useSkillFilters';
import { useSkillActions } from '@/pages/Dashboard/hooks/useSkillActions';
import { useSkillModal } from '@/pages/Dashboard/hooks/useSkillModal';
import { useDragDrop } from '@/pages/Dashboard/hooks/useDragDrop';
import { usePanelResize } from '@/pages/Dashboard/hooks/usePanelResize';

// Components
import { SkillCard } from '@/pages/Dashboard/components/SkillCard';
import { SearchAndFilterBar } from '@/pages/Dashboard/components/SearchAndFilterBar';
import { DragDropOverlay } from '@/pages/Dashboard/components/DragDropOverlay';
import { ImportingOverlay } from '@/pages/Dashboard/components/ImportingOverlay';
import { DeleteConfirmModal } from '@/pages/Dashboard/components/DeleteConfirmModal';
import { EmptyView } from '@/pages/Dashboard/components/EmptyView';
import { SkillDetailModal } from '@/pages/Dashboard/components/SkillDetailModal';
import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import MarketplaceSkillCard from '@/pages/Dashboard/components/MarketplaceSkillCard';
import type { Skill } from '@/types/skills';

const DASHBOARD_VIEW_MODE_KEY = 'skills-manager:dashboard:viewMode';
/** v2：默认来源改为 global，与旧键分离以免会话里仍残留此前的默认 claude */
const DASHBOARD_SELECTED_SOURCE_KEY = 'skills-manager:dashboard:selectedSourceV2';

function readPersistedDashboardNav(): { viewMode: 'flat' | 'agent'; selectedSource: string } {
  try {
    const vm = sessionStorage.getItem(DASHBOARD_VIEW_MODE_KEY);
    const src = sessionStorage.getItem(DASHBOARD_SELECTED_SOURCE_KEY);
    const viewMode: 'flat' | 'agent' = vm === 'agent' ? 'agent' : 'flat';
    const selectedSource =
      src === 'global' || src === 'claude' || src === 'cursor' ? src : 'global';
    return { viewMode, selectedSource };
  } catch {
    return { viewMode: 'flat', selectedSource: 'global' };
  }
}

/** 平铺去重：同 id 多来源时保留一条（优先 global），与列表展示逻辑一致 */
function dedupeSkillsByIdPreferGlobal(skills: SkillMetadata[]): SkillMetadata[] {
  const sourcePriority = (s: SkillMetadata): number => {
    if (s.source === 'global') return 0;
    if (s.source === 'claude') return 1;
    if (s.source === 'cursor') return 2;
    return 3;
  };
  const byId = new Map<string, SkillMetadata>();
  for (const skill of skills) {
    const cur = byId.get(skill.id);
    if (!cur || sourcePriority(skill) < sourcePriority(cur)) {
      byId.set(skill.id, skill);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { t } = useTranslation();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SkillMetadata | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'agent'>(() => readPersistedDashboardNav().viewMode);
  const [selectedSource, setSelectedSource] = useState<string>(() => readPersistedDashboardNav().selectedSource);
  const [githubTipDismissed, setGithubTipDismissed] = useState(() => sessionStorage.getItem('githubTipDismissed') === 'true');
  /** 帮助气泡挂 Portal：与 Toast 一样在 body 层 fixed，backdrop-blur 才能作用到整窗，否则会透出下层 Tab 等 */
  const [helpPopover, setHelpPopover] = useState<{ open: boolean; anchor: DOMRect | null }>({
    open: false,
    anchor: null,
  });
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewTabs = [
    { id: 'flat', label: '平铺展示', icon: 'grid_view' },
    { id: 'agent', label: '按来源展示', icon: 'smart_toy' },
  ];

  // 离开再进入 Dashboard（如去 GitHub 备份页）时保留视图与来源 Tab：写入 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(DASHBOARD_VIEW_MODE_KEY, viewMode);
      sessionStorage.setItem(DASHBOARD_SELECTED_SOURCE_KEY, selectedSource);
    } catch {
      /* ignore quota / private mode */
    }
  }, [viewMode, selectedSource]);

  const handleViewModeChange = (mode: string) => {
    setViewMode(mode === 'agent' ? 'agent' : 'flat');
  };

  // Custom hooks
  const { skills, setSkills, agents, loading, error, loadSkills, refreshSkills } = useSkillData();

  // 延迟显示/隐藏帮助，配合hover效果
  const handleHelpMouseEnter = () => {
    if (helpTimeoutRef.current) {
      clearTimeout(helpTimeoutRef.current);
    }
    const el = helpButtonRef.current;
    const anchor = el ? el.getBoundingClientRect() : null;
    setHelpPopover({ open: true, anchor });
  };

  const handleHelpMouseLeave = () => {
    if (helpTimeoutRef.current) {
      clearTimeout(helpTimeoutRef.current);
    }
    helpTimeoutRef.current = setTimeout(() => {
      setHelpPopover({ open: false, anchor: null });
    }, 100);
  };

  useLayoutEffect(() => {
    if (!helpPopover.open) return;
    const update = () => {
      const el = helpButtonRef.current;
      if (!el) return;
      setHelpPopover((p) => (p.open ? { ...p, anchor: el.getBoundingClientRect() } : p));
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [helpPopover.open]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (helpTimeoutRef.current) {
        clearTimeout(helpTimeoutRef.current);
      }
    };
  }, []);
  const { searchTerm, setSearchTerm, filterType, setFilterType, filteredSkills } = useSkillFilters(skills);
  const { handleToggleSkill, handleToggleAgent, handleDeleteSkill, handleAddToRoot } = useSkillActions(skills, setSkills);

  /** 仅平铺视图：同 id 多来源时保留一条（优先 global），避免重复卡片；按来源 Tab 仍用完整 filteredSkills */
  const filteredSkillsForFlat = useMemo(() => dedupeSkillsByIdPreferGlobal(filteredSkills), [filteredSkills]);

  /** 全量技能中与平铺去重相比多出的条数，用于平铺底部「已过滤 n 条重复」 */
  const skillsFlatDedupeExtraCount = useMemo(
    () => Math.max(0, skills.length - dedupeSkillsByIdPreferGlobal(skills).length),
    [skills]
  );

  // 将SkillMetadata转换为Marketplace的Skill格式
  const convertToMarketplaceSkill = (skill: SkillMetadata): Skill => {
    const enabledCount = Object.values(skill.agent_enabled || {}).filter(Boolean).length;
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version || '1.0.0',
      category: 'Skill',
      icon: getSkillIcon(skill.id),
      iconColor: getSkillColor(skill.id),
      enabledAgentCount: enabledCount,
      totalAgentCount: agents.filter(a => a.detected).length,
      size: skill.size,
      author: 'Skills Manager',
      installed: skill.enabled,
    };
  };

  // 按来源过滤
  const filteredBySource = filteredSkills.filter(skill => {
    if (selectedSource === 'claude') return skill.source === 'claude';
    if (selectedSource === 'cursor') return skill.source === 'cursor';
    if (selectedSource === 'global') return skill.source === 'global';
    return true;
  });

  const marketplaceSkills = filteredBySource.map(convertToMarketplaceSkill);
  const {
    detailSkill,
    showDetailModal,
    skillFiles,
    loadingFiles,
    expandedFolders,
    currentFile,
    loadingFile,
    handleShowSkillDetail,
    handleCloseDetailModal,
    toggleFolder,
    handleReadFile,
  } = useSkillModal();

  /** 弹窗内技能数据需与 skills 同步，否则开关只更新了列表状态、UI 仍引用打开时的旧对象 */
  const detailSkillLive = useMemo((): SkillMetadata | null => {
    if (!detailSkill) return null;
    return (
      skills.find((s) => s.id === detailSkill.id && s.source === detailSkill.source) ??
      skills.find((s) => s.id === detailSkill.id) ??
      detailSkill
    );
  }, [skills, detailSkill]);

  // Esc：删除确认优先于技能详情关闭
  useEffect(() => {
    if (!showDetailModal && !deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) {
        e.preventDefault();
        setDeleteTarget(null);
        return;
      }
      if (showDetailModal) {
        e.preventDefault();
        handleCloseDetailModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDetailModal, deleteTarget, handleCloseDetailModal]);

  const { isDragOver, importing } = useDragDrop(loadSkills);
  const { leftPanelWidth, isResizing, handleMouseDown } = usePanelResize();

  // Handlers
  const toggleExpand = (skillId: string) => {
    setExpandedCards(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(skillId)) {
        newExpanded.delete(skillId);
      } else {
        newExpanded.add(skillId);
      }
      return newExpanded;
    });
  };

  const handleDeleteConfirm = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    handleCloseDetailModal();
    if (target) {
      await handleDeleteSkill(target);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader icon="extension" title={t('header.dashboard')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-dark-bg-tertiary border-t-[#b71422] mb-4"></div>
            <p className="text-slate-500 dark:text-gray-300 font-medium">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader icon="extension" title={t('header.dashboard')} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white dark:bg-dark-bg-card rounded-xl p-6 border border-red-200 dark:border-red-900/30 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">error</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('common.error')}</h3>
            </div>
            <p className="text-slate-600 dark:text-gray-300 mb-2">{error}</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
              {t('dashboard.errorMessage')}
            </p>
            <button
              onClick={loadSkills}
              className="w-full bg-[#b71422] hover:bg-[#a01220] text-white px-4 py-2 rounded-lg font-bold transition-all"
            >
              {t('dashboard.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon="extension"
        title={t('header.dashboard')}
        center={<TabSwitcher tabs={viewTabs} activeTab={viewMode} onTabChange={handleViewModeChange} />}
        actions={
          <div className="flex items-center">
            <button
              ref={helpButtonRef}
              onMouseEnter={handleHelpMouseEnter}
              onMouseLeave={handleHelpMouseLeave}
              className="rounded-xl p-2 transition-colors hover:bg-slate-100/80 dark:hover:bg-white/10"
              title="视图说明"
            >
              <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">
                help
              </span>
            </button>
          </div>
        }
      />

      {/* 搜索栏 - 固定；overflow-visible 供统计条 hover 气泡向上伸出 */}
      <div className="overflow-visible bg-[#f8f9fa] dark:bg-dark-bg-secondary px-8 py-4">
        <div className="max-w-6xl mx-auto">
          <SearchAndFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onFilterChange={setFilterType}
            skills={skills}
            viewMode={viewMode as 'flat' | 'agent'}
            selectedSource={selectedSource}
            onSourceSelect={setSelectedSource}
          />
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className={`relative flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary ${isDragOver ? 'px-0 border-4 border-[#b71422] bg-white/90 dark:bg-dark-bg-primary rounded-xl mx-8' : 'px-8'}`}>
        <div className="max-w-6xl mx-auto">
          {viewMode === 'flat' && (
            <>
              {filteredSkillsForFlat.length === 0 ? (
                <EmptyView message={searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')} />
              ) : (
                <>
                  <div className="flex flex-col lg:flex-row gap-4 items-start">
                    {/* 奇偶分两列：卡片可展开，Grid 同行对齐易产生大块空白；独立纵列更自然 */}
                    <div className="flex-1 space-y-4">
                      {filteredSkillsForFlat.filter((_, i) => i % 2 === 0).map((skill) => (
                        <SkillCard
                          key={`${skill.id}:${skill.source ?? ''}`}
                          skill={skill}
                          agents={agents}
                          expanded={expandedCards.has(skill.id)}
                          onToggleExpand={toggleExpand}
                          onToggleSkill={handleToggleSkill}
                          onToggleAgent={handleToggleAgent}
                          onShowDetail={handleShowSkillDetail}
                        />
                      ))}
                      <div className="lg:hidden space-y-4">
                        {filteredSkillsForFlat.filter((_, i) => i % 2 === 1).map((skill) => (
                          <SkillCard
                            key={`${skill.id}:${skill.source ?? ''}`}
                            skill={skill}
                            agents={agents}
                            expanded={expandedCards.has(skill.id)}
                            onToggleExpand={toggleExpand}
                            onToggleSkill={handleToggleSkill}
                            onToggleAgent={handleToggleAgent}
                            onShowDetail={handleShowSkillDetail}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 hidden lg:block">
                      {filteredSkillsForFlat.filter((_, i) => i % 2 === 1).map((skill) => (
                        <SkillCard
                          key={`${skill.id}:${skill.source ?? ''}`}
                          skill={skill}
                          agents={agents}
                          expanded={expandedCards.has(skill.id)}
                          onToggleExpand={toggleExpand}
                          onToggleSkill={handleToggleSkill}
                          onToggleAgent={handleToggleAgent}
                          onShowDetail={handleShowSkillDetail}
                        />
                      ))}
                    </div>
                  </div>
                  {skillsFlatDedupeExtraCount > 0 && (
                    <p className="mt-5 pb-2 text-center text-[11px] text-slate-400 dark:text-gray-500">
                      {t('dashboard.stats.dedupeFooter', { count: skillsFlatDedupeExtraCount })}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {viewMode === 'agent' && (
            <div className="bg-[#f8f9fa] dark:bg-dark-bg-secondary">
              {selectedSource === 'global' && !githubTipDismissed && (
                <div className="mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.67-.3-5.46-1.334-5.46-5.925 0-1.305.465-2.38 1.23-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.005-.322 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.297-1.23 3.297-1.23.66 1.653.242 2.874.118 3.176.77.84 1.235 1.905 1.235 3.22 0 4.605-2.805 5.624-5.475 5.921.43.372.823 1.102.823 2.22 0 1.605-.015 2.89-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <p className="text-xs text-[#5e5e5e] dark:text-gray-400">
                    收录至根目录的技能可以通过
                    <span
                      className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline"
                      onClick={() => onNavigate('githubBackup')}
                    > GitHub 备份</span>
                    同步到远端仓库
                  </p>
                  <button
                    onClick={() => { setGithubTipDismissed(true); sessionStorage.setItem('githubTipDismissed', 'true'); }}
                    className="text-xs text-[#5e5e5e] dark:text-gray-400 hover:text-[#b71422] dark:hover:text-[#b71422] transition-colors ml-1"
                  >
                    知道了
                  </button>
                </div>
              )}
              <div className="space-y-6">
                {/* Skills Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {marketplaceSkills.map((skill) => {
                    const originalSkill = filteredBySource.find(s => s.id === skill.id);
                    const isGlobalSource = originalSkill?.source === 'global';
                    const existsInRoot = !isGlobalSource && skills.some(s => s.id === skill.id && s.source === 'global');

                    return (
                      <MarketplaceSkillCard
                        key={skill.id}
                        skill={skill}
                        onInstall={() => {
                          const orig = skills.find(s => s.id === skill.id);
                          if (orig) {
                            handleToggleSkill(orig);
                          }
                        }}
                        onInfo={() => {
                          const orig = filteredBySource.find((s) => s.id === skill.id);
                          if (orig) handleShowSkillDetail(orig);
                        }}
                        onDelete={isGlobalSource ? () => originalSkill && setDeleteTarget(originalSkill) : undefined}
                        onAddToRoot={!isGlobalSource ? () => originalSkill && handleAddToRoot(originalSkill).then(() => refreshSkills()) : undefined}
                        isInRoot={!isGlobalSource ? existsInRoot : undefined}
                      />
                    );
                  })}
                </div>

                {marketplaceSkills.length === 0 && (
                  <EmptyView message="该来源下暂无技能" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drag & Drop Overlay */}
        {isDragOver && <DragDropOverlay />}

        {/* Importing Overlay */}
        {importing && <ImportingOverlay />}
      </div>

      {/* Skill Detail Modal */}
      {showDetailModal && detailSkillLive && (
        <SkillDetailModal
          skill={detailSkillLive}
          agents={agents}
          skillFiles={skillFiles}
          loadingFiles={loadingFiles}
          expandedFolders={expandedFolders}
          currentFile={currentFile}
          loadingFile={loadingFile}
          leftPanelWidth={leftPanelWidth}
          isResizing={isResizing}
          onClose={handleCloseDetailModal}
          onToggleFolder={toggleFolder}
          onReadFile={handleReadFile}
          onToggleAgent={handleToggleAgent}
          onDelete={() => setDeleteTarget(detailSkillLive)}
          onResizeStart={handleMouseDown}
        />
      )}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {helpPopover.open &&
        helpPopover.anchor &&
        (() => {
          const rect = helpPopover.anchor as DOMRect;
          const vw = window.innerWidth;
          const width = Math.min(352, vw - 16);
          let left = rect.right - width;
          left = Math.max(8, Math.min(left, vw - width - 8));
          const bridge = 12;
          return createPortal(
            <div
              style={{
                position: 'fixed',
                top: rect.bottom - bridge,
                left,
                width,
                paddingTop: bridge,
                zIndex: 9998,
              }}
              className="pointer-events-auto"
              onMouseEnter={handleHelpMouseEnter}
              onMouseLeave={handleHelpMouseLeave}
            >
              <div
                className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} max-h-[min(70vh,28rem)] overflow-hidden p-4 animate-toast-in`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center self-start rounded-full bg-info/10 dark:bg-info/20">
                  <span
                    className="material-symbols-outlined text-xl text-info"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    info
                  </span>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
                  <p className="break-words text-sm font-bold text-slate-900 dark:text-white">视图说明</p>
                  <div className="mt-1 space-y-3 text-xs leading-normal text-slate-500 dark:text-gray-400">
                    <div>
                      <p className="mb-1 font-bold text-slate-800 dark:text-gray-200">平铺展示</p>
                      <p>扫描本地所有 Agent，显示所有可用的 Skills（不区分 Agent 来源）</p>
                    </div>
                    <div>
                      <p className="mb-1 font-bold text-slate-800 dark:text-gray-200">按来源展示</p>
                      <p>按照不同的 Agent 对 Skills 进行分类展示，可以清晰地看到每个 Agent 下有哪些 Skills</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}
    </div>
  );
}

export default Dashboard;
