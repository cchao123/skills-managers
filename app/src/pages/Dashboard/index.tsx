import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import { useToast } from '@/components/Toast';
import type { SkillMetadata, Skill, MergedSkillInfo } from '@/types';
import { SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, PAGE, type Page, getAgentRootPath } from '@/constants';
import { TabSwitcher } from '@/components/TabSwitcher';

// Hooks
import { useSkillData } from '@/pages/Dashboard/hooks/useSkillData';
import { useSkillFilters } from '@/pages/Dashboard/hooks/useSkillFilters';
import { usePrefixFilteredSkills } from '@/pages/Dashboard/hooks/usePrefixFilteredSkills';
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
import { agentsApi } from '@/api/tauri';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { SOURCE, sourceDisplayName, isSource } from '@/pages/Dashboard/utils/source';
import { useDetectedAgents } from '@/pages/Dashboard/hooks/useDetectedAgents';
import { VIEW_MODE, type ViewMode, isViewMode } from '@/pages/Dashboard/constants/viewMode';
import { useColumnCount } from '@/hooks/useColumnCount';

function readPersistedDashboardNav(): { viewMode: ViewMode; selectedSource: string } {
  try {
    const vm = sessionStorage.getItem(SESSION_STORAGE_KEYS.dashboardViewMode);
    const src = sessionStorage.getItem(SESSION_STORAGE_KEYS.dashboardSelectedSourceV2);
    const viewMode: ViewMode = isViewMode(vm) ? vm : VIEW_MODE.Flat;
    const selectedSource = isSource(src) ? src : SOURCE.Global;
    return { viewMode, selectedSource };
  } catch {
    return { viewMode: VIEW_MODE.Flat, selectedSource: SOURCE.Global };
  }
}

/** 平铺视图：同 id 多来源合并为一张卡片 */
function mergeSkillsById(skills: SkillMetadata[]): MergedSkillInfo[] {
  const byId = new Map<string, SkillMetadata[]>();
  for (const skill of skills) {
    const group = byId.get(skill.id) || [];
    group.push(skill);
    byId.set(skill.id, group);
  }

  const sourcePriority = (s: string) => (s === SOURCE.Global ? 0 : s === SOURCE.Claude ? 1 : 2);

  const result: MergedSkillInfo[] = [];
  for (const [, group] of byId) {
    const sorted = [...group].sort((a, b) =>
      sourcePriority(a.source ?? SOURCE.Global) - sourcePriority(b.source ?? SOURCE.Global)
    );
    const primary = sorted[0];

    const allSources = sorted.map(s => s.source ?? SOURCE.Global);
    const nativeAgents = new Set(allSources.filter(src => src !== SOURCE.Global));
    const allPaths = sorted
      .filter(s => s.path)
      .map(s => ({ source: s.source ?? SOURCE.Global, path: s.path! }));

    const mergedAgentEnabled: Record<string, boolean> = {};
    for (const skill of sorted) {
      for (const [agent, enabled] of Object.entries(skill.agent_enabled || {})) {
        mergedAgentEnabled[agent] = mergedAgentEnabled[agent] || enabled;
      }
    }
    for (const agent of nativeAgents) {
      mergedAgentEnabled[agent] = true;
    }

    result.push({
      primary: {
        ...primary,
        agent_enabled: mergedAgentEnabled,
        enabled: Object.values(mergedAgentEnabled).some(v => v),
      },
      sourceSkills: sorted,
      allSources,
      nativeAgents,
      allPaths,
    });
  }

  return result.sort((a, b) => a.primary.id.localeCompare(b.primary.id));
}

function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SkillMetadata | null>(null);
  // deleteMultiSource removed: always show all source paths in delete modal
  const [viewMode, setViewMode] = useState<ViewMode>(() => readPersistedDashboardNav().viewMode);
  const [selectedSource, setSelectedSource] = useState<string>(() => readPersistedDashboardNav().selectedSource);
  const [githubTipDismissed, setGithubTipDismissed] = useState(
    () => sessionStorage.getItem(SESSION_STORAGE_KEYS.githubTipDismissed) === 'true'
  );
  const [advancedMode, setAdvancedMode] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEYS.advancedMode) === 'true'
  );
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEYS.advancedMode) {
        setAdvancedMode(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  /** 帮助气泡挂 Portal：与 Toast 一样在 body 层 fixed，backdrop-blur 才能作用到整窗，否则会透出下层 Tab 等 */
  const [helpPopover, setHelpPopover] = useState<{ open: boolean; anchor: DOMRect | null }>({
    open: false,
    anchor: null,
  });
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewTabs = [
    { id: VIEW_MODE.Flat, label: t('dashboard.viewFlat'), icon: 'grid_view' },
    { id: VIEW_MODE.Agent, label: t('dashboard.viewBySource'), icon: 'smart_toy' },
  ];

  // 离开再进入 Dashboard（如去 GitHub 备份页）时保留视图与来源 Tab：写入 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.dashboardViewMode, viewMode);
      sessionStorage.setItem(SESSION_STORAGE_KEYS.dashboardSelectedSourceV2, selectedSource);
    } catch {
      /* ignore quota / private mode */
    }
  }, [viewMode, selectedSource]);

  const handleViewModeChange = (mode: string) => {
    setViewMode(isViewMode(mode) ? mode : VIEW_MODE.Flat);
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
  const prefixFilteredSkills = usePrefixFilteredSkills(skills);
  const { handleToggleSkill, handleToggleAgent, handleToggleSkillMerged, handleToggleAgentMerged, handleDeleteSkill, handleAddToRoot } = useSkillActions(skills, setSkills, agents);
  const detectedAgents = useDetectedAgents(agents);

  /** 平铺视图：同 id 多来源合并为一张卡片 */
  const mergedSkillsForFlat = useMemo(() => mergeSkillsById(filteredSkills), [filteredSkills]);

  /**
   * 手动瀑布流分列：按响应式断点把合并后的列表按 round-robin 拆成 N 列，
   * 每列成为独立 DOM，展开/折叠某张卡片只影响本列高度，不会把后续卡片挤到相邻列。
   */
  const columnCount = useColumnCount();
  const flatColumns = useMemo<MergedSkillInfo[][]>(() => {
    const cols: MergedSkillInfo[][] = Array.from({ length: columnCount }, () => []);
    mergedSkillsForFlat.forEach((m, i) => {
      cols[i % columnCount].push(m);
    });
    return cols;
  }, [mergedSkillsForFlat, columnCount]);

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
      totalAgentCount: detectedAgents.length,
      size: skill.size,
      author: 'Skills Manager',
      installed: skill.enabled,
    };
  };

  // 按来源过滤：`selectedSource` 直接等于 skill.source 即可（'global' | 'cursor' | 'claude' | ...）
  const filteredBySource = filteredSkills.filter(skill => skill.source === selectedSource);

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

  /** 弹窗内技能数据需与 skills 同步 */
  const detailSkillLive = useMemo((): SkillMetadata | null => {
    if (!detailSkill) return null;
    return (
      skills.find((s) => s.id === detailSkill.id && s.source === detailSkill.source) ??
      skills.find((s) => s.id === detailSkill.id) ??
      detailSkill
    );
  }, [skills, detailSkill]);

  /** 弹窗中的合并来源信息（与 skills 状态同步重算） */
  const detailMergedLive = useMemo((): MergedSkillInfo | undefined => {
    if (!detailSkill) return undefined;
    const group = skills.filter(s => s.id === detailSkill.id);
    if (group.length <= 1) return undefined;
    const merged = mergeSkillsById(group);
    return merged[0];
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

  const { isDragOver, importing } = useDragDrop(useCallback((importedNames: string[]) => {
    loadSkills();
    if (importedNames.length === 1) {
      setSearchTerm(importedNames[0]);
    }
  }, [loadSkills, setSearchTerm]));
  const { leftPanelWidth, isResizing, handleMouseDown } = usePanelResize();

  // Handlers
  const toggleExpand = (cardKey: string) => {
    setExpandedCards(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(cardKey)) {
        newExpanded.delete(cardKey);
      } else {
        newExpanded.add(cardKey);
      }
      return newExpanded;
    });
  };

  const handleDeleteConfirm = async (selected: SkillMetadata[]) => {
    setDeleteTarget(null);
    handleCloseDetailModal();

    const succeeded: string[] = [];
    const failed: string[] = [];
    for (const s of selected) {
      try {
        await handleDeleteSkill(s, true);
        succeeded.push(sourceDisplayName(s.source));
      } catch {
        failed.push(sourceDisplayName(s.source));
      }
    }

    const name = selected[0]?.name ?? '';
    if (succeeded.length > 0) {
      showToast('success', t('dashboard.toast.skillDeletedFrom', { name, sources: succeeded.join('、') }));
    }
    if (failed.length > 0) {
      showToast('error', t('dashboard.toast.skillDeleteFromFailed', { name, sources: failed.join('、') }));
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
        center={<div className="flex gap-3">
          <TabSwitcher tabs={viewTabs} activeTab={viewMode} onTabChange={handleViewModeChange} />
          <button
            className="flex items-center justify-center"
            ref={helpButtonRef}
            onMouseEnter={handleHelpMouseEnter}
            onMouseLeave={handleHelpMouseLeave}
            title={t('dashboard.viewHelp')}
          >
            <span className="material-symbols-outlined text-lg text-slate-600 dark:text-gray-300">
              help
            </span>
          </button>
        </div>
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              onClick={() => {
                try {
                  sessionStorage.setItem(SESSION_STORAGE_KEYS.settingsInitialTab, 'agents');
                } catch {
                  /* ignore */
                }
                onNavigate(PAGE.Settings);
              }}
              title={t('dashboard.openAgentSettings')}
            >
              <span className="material-symbols-outlined material-symbols-legacy text-lg text-slate-500 dark:text-gray-400">folder_open</span>
              <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
                {t('dashboard.localAgentDirectory')}
              </span>
            </button>
          </div>
        }
      />

      {/* 搜索栏 - 固定；overflow-visible 供统计条 hover 气泡向上伸出 */}
      <div className="overflow-visible bg-[#f8f9fa] dark:bg-dark-bg-secondary px-8 py-4">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto">
          <SearchAndFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onFilterChange={setFilterType}
            skills={prefixFilteredSkills}
            agents={agents}
            viewMode={viewMode}
            selectedSource={selectedSource}
            onSourceSelect={setSelectedSource}
          />
        </div>
      </div>

      {/* 内容区域 - 可滚动 */}
      <div className={`relative flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary ${isDragOver ? 'px-0 border-4 border-[#b71422] bg-white/90 dark:bg-dark-bg-primary rounded-xl mx-8' : 'px-8'}`}>
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto">
          {viewMode === VIEW_MODE.Flat && (
            <>
              {mergedSkillsForFlat.length === 0 ? (
                <EmptyView message={searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')} />
              ) : (
                <div className="flex gap-4 items-start">
                  {flatColumns.map((col, colIdx) => (
                    <div key={colIdx} className="flex-1 min-w-0 space-y-4">
                      {col.map((m) => {
                        const cardKey = m.primary.id;
                        return (
                          <SkillCard
                            key={cardKey}
                            skill={m.primary}
                            agents={agents}
                            expanded={expandedCards.has(cardKey)}
                            merged={m}
                            onToggleExpand={() => toggleExpand(cardKey)}
                            onToggleSkill={handleToggleSkill}
                            onToggleAgent={handleToggleAgent}
                            onToggleSkillMerged={handleToggleSkillMerged}
                            onToggleAgentMerged={handleToggleAgentMerged}
                            onShowDetail={handleShowSkillDetail}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === VIEW_MODE.Agent && (
            <div className="bg-[#f8f9fa] dark:bg-dark-bg-secondary">
              {selectedSource === SOURCE.Global && (
                <div className="mb-4 flex items-center gap-2">
                  <img src="/octopus-logo.png" alt="Skills Manager" className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs text-[#5e5e5e] dark:text-gray-400">
                    {t('dashboard.rootPathLabel')}
                    <span
                      className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline font-mono"
                      onClick={() => agentsApi.openFolderPath('~/.skills-manager').catch(() => { })}
                    >~/.skills-manager </span>
                    {!githubTipDismissed && (
                      <>
                        {t('dashboard.githubTipMid')}
                        <span
                          className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline"
                          onClick={() => onNavigate(PAGE.GitHubBackup)}
                        >{t('dashboard.githubTipLink')}</span>
                        {t('dashboard.githubTipAfter')}
                      </>
                    )}
                  </p>
                  {!githubTipDismissed && (
                    <button
                      onClick={() => {
                        setGithubTipDismissed(true);
                        sessionStorage.setItem(SESSION_STORAGE_KEYS.githubTipDismissed, 'true');
                      }}
                      className="w-[14px] h-[14px] rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ml-1 flex items-center"
                    >
                      <span className="material-symbols-outlined text-sm text-slate-400 dark:text-gray-500 hover:text-[#b71422]">close</span>
                    </button>
                  )}
                </div>
              )}
              {selectedSource !== SOURCE.Global && (() => {
                // Source 名与 agent 名对齐（除 Global），直接用 selectedSource 作为 agent name 查询元信息
                const path = getAgentRootPath(selectedSource);
                const icon = getAgentIcon(selectedSource);
                return path ? (
                  <div className="mb-4 flex items-center gap-2">
                    {icon ? (
                      <img src={icon} alt="" className={`w-4 h-4 flex-shrink-0 ${needsInvertInDark(selectedSource) ? 'dark:invert' : ''}`} />
                    ) : (
                      <span className="material-symbols-outlined text-base text-gray-500 dark:text-gray-400">folder_open</span>
                    )}
                    <p className="text-xs text-[#5e5e5e] dark:text-gray-400">
                      {t('dashboard.agentSourcePath')}
                      <span
                        className="text-[#2563eb] dark:text-blue-400 cursor-pointer hover:underline font-mono"
                        onClick={() => agentsApi.openFolderPath(path).catch(() => { })}
                      >{path}</span>
                    </p>
                  </div>
                ) : null;
              })()}
              <div className="space-y-6 pb-8">
                {/* Skills Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {marketplaceSkills.map((skill, idx) => {
                    const originalSkill = filteredBySource[idx];

                    // 基础props：始终存在
                    const baseProps = {
                      key: `${skill.id}:${originalSkill?.source ?? ''}`,
                      skill,
                      onInfo: () => {
                        if (originalSkill) handleShowSkillDetail(originalSkill);
                      },
                    };

                    // 根据不同情况添加按钮props
                    if (originalSkill?.source === SOURCE.Global) {
                      // 情况1：根目录tab → 只提供删除功能
                      return (
                        <MarketplaceSkillCard
                          {...baseProps}
                          onDelete={() => setDeleteTarget(originalSkill)}
                        />
                      );
                    }

                    // 情况2：其他tab (Cursor/agent) → 提供添加功能
                    // 检查技能是否已存在于根目录
                    const existsInRoot = skills.some(s => s.id === skill.id && s.source === SOURCE.Global);

                    return (
                      <MarketplaceSkillCard
                        {...baseProps}
                        onAddToRoot={(skillId) => {
                          console.log(`[DEBUG] 点击拷贝到根目录: ${skill.name} (ID: ${skillId})`);
                          const targetSkill = skills.find(s => s.id === skillId && s.source === selectedSource);
                          if (targetSkill) {
                            console.log(`[DEBUG] 找到技能:`, targetSkill);
                            handleAddToRoot(targetSkill).then(() => {
                              console.log(`[DEBUG] 拷贝完成，刷新中...`);
                              refreshSkills().then(() => {
                                console.log(`[DEBUG] 刷新完成`);
                              });
                            });
                          } else {
                            console.error(`[DEBUG] 未找到技能: ${skillId}`);
                          }
                        }}
                        isInRoot={existsInRoot}
                      />
                    );
                  })}
                </div>

                {marketplaceSkills.length === 0 && (
                  <EmptyView message={t('dashboard.noSkillsInSource')} />
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
          skill={detailMergedLive?.primary ?? detailSkillLive}
          agents={agents}
          skillFiles={skillFiles}
          loadingFiles={loadingFiles}
          expandedFolders={expandedFolders}
          currentFile={currentFile}
          loadingFile={loadingFile}
          leftPanelWidth={leftPanelWidth}
          isResizing={isResizing}
          merged={detailMergedLive}
          onClose={handleCloseDetailModal}
          onToggleFolder={toggleFolder}
          onReadFile={handleReadFile}
          onToggleAgent={handleToggleAgent}
          onToggleAgentMerged={handleToggleAgentMerged}
          onDelete={(detailSkillLive.source === SOURCE.Global || advancedMode) ? () => {
            setDeleteTarget(detailSkillLive);
          } : undefined}
          onResizeStart={handleMouseDown}
        />
      )}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        allSourceSkills={
          deleteTarget && deleteTarget.source === SOURCE.Global
            ? [deleteTarget]  // 根目录tab中只删除根目录技能，不显示多选框
            : deleteTarget
              ? skills.filter(s => s.id === deleteTarget.id)
              : undefined
        }
        purpose={deleteTarget?.source === SOURCE.Global ? 'root-only' : 'multi-source'}
        advancedMode={advancedMode}
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
                  <p className="break-words text-sm font-bold text-slate-900 dark:text-white">{t('dashboard.viewHelp')}</p>
                  <div className="mt-1 space-y-3 text-xs leading-normal text-slate-500 dark:text-gray-400">
                    <div>
                      <p className="mb-1 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.viewFlat')}</p>
                      <p>{t('dashboard.viewHelpFlat')}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.viewBySource')}</p>
                      <p>{t('dashboard.viewHelpBySource')}</p>
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
