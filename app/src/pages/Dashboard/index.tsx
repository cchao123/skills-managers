import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import { useToast } from '@/components/Toast';
import type { SkillMetadata, Skill, SkillDeletionRow } from '@/types';
import { SESSION_STORAGE_KEYS, LOCAL_STORAGE_KEYS, PAGE, type Page, getAgentRootPath } from '@/constants';
import { TabSwitcher } from '@/components/TabSwitcher';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';

// Hooks
import { useSkillData } from '@/pages/Dashboard/hooks/useSkillData';
import { useSkillFilters } from '@/pages/Dashboard/hooks/useSkillFilters';
import { usePrefixFilteredSkills } from '@/pages/Dashboard/hooks/usePrefixFilteredSkills';
import { FILTER_TYPE } from '@/pages/Dashboard/constants/filterType';
import { useSkillActions } from '@/pages/Dashboard/hooks/useSkillActions';
import { useSkillModal } from '@/pages/Dashboard/hooks/useSkillModal';
import { useDragDrop } from '@/pages/Dashboard/hooks/useDragDrop';
import { usePanelResize } from '@/pages/Dashboard/hooks/usePanelResize';

// Components
import { SkillCard } from '@/pages/Dashboard/components/SkillCard';
import { MainToggleIndicator, MAIN_TOGGLE_STATES } from '@/pages/Dashboard/components/MainToggleIndicator';
import { OperationLogPopover } from '@/pages/Dashboard/components/OperationLogPopover';
import { appendOperationLog } from '@/pages/Dashboard/hooks/useOperationLog';
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

/**
 * Schema v2：把后端已合并的单条 skill 按 sources/source_paths 展开成多行，
 * 供"从详情删除多源技能"场景下的 DeleteConfirmModal 多选展示与逐源删除。
 */
function expandToSourceRows(skill: SkillMetadata | null): SkillDeletionRow[] {
  if (!skill) return [];
  const sources = skill.sources?.length ? skill.sources : [SOURCE.Global];
  return sources.map(src => ({
    skill,
    source: src,
    path: skill.source_paths?.[src],
  }));
}

function Dashboard({
  onNavigate,
  isActive = true,
}: {
  onNavigate: (page: Page) => void;
  /** 由 App 传入：当前是否在展示本页。false 时页面被 display:none 隐藏，
   *  切回（false→true）时做一次静默刷新，避免用户盯着过期数据。 */
  isActive?: boolean;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SkillMetadata | null>(null);
  /** 删除是否来自"根目录 tab 的卡片"：true = 仅单行删除中央存储副本；false = 多源展开 */
  const [deleteTargetFromRoot, setDeleteTargetFromRoot] = useState(false);
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

  // 操作日志 popover（点击开 / Esc 或外部点击关）
  const [logPopoverAnchor, setLogPopoverAnchor] = useState<DOMRect | null>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);
  const toggleLogPopover = () => {
    if (logPopoverAnchor) {
      setLogPopoverAnchor(null);
      return;
    }
    const rect = logButtonRef.current?.getBoundingClientRect();
    if (rect) setLogPopoverAnchor(rect);
  };

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
  const { skills, setSkills, agents, loading, error, loadSkills, refreshSkills, loadAgents } = useSkillData();

  // 从隐藏切回到激活状态时做一次静默刷新（不触发 loading spinner）。
  // 这样用户先看到之前的数据，后台扫描完再平滑更新。
  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;
    if (!wasActive && isActive) {
      void refreshSkills();
      void loadAgents();
    }
  }, [isActive, refreshSkills, loadAgents]);

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
  const filterTypeRef = useRef(filterType);
  filterTypeRef.current = filterType;
  const prefixFilteredSkills = usePrefixFilteredSkills(skills);
  const { handleToggleSkillMerged, handleToggleAgentMerged, handleDeleteSkill, handleAddToRoot } = useSkillActions(skills, setSkills, agents);
  const detectedAgents = useDetectedAgents(agents);

  /** 平铺视图：后端已按 id 合并，这里只需按 id 稳定排序 */
  const flatSkills = useMemo(
    () => [...filteredSkills].sort((a, b) => a.id.localeCompare(b.id)),
    [filteredSkills],
  );

  /**
   * 手动瀑布流分列：按响应式断点把列表按 round-robin 拆成 N 列，
   * 每列成为独立 DOM，展开/折叠某张卡片只影响本列高度，不会把后续卡片挤到相邻列。
   */
  const columnCount = useColumnCount();
  const flatColumns = useMemo<SkillMetadata[][]>(() => {
    const cols: SkillMetadata[][] = Array.from({ length: columnCount }, () => []);
    flatSkills.forEach((s, i) => {
      cols[i % columnCount].push(s);
    });
    return cols;
  }, [flatSkills, columnCount]);

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

  // 按来源过滤：Schema v2 中一条 skill 可能分布在多个源里，
  // 只要 `sources` 包含当前选中源就展示。下游组件按 `selectedSource` 定位当前 tab。
  const filteredBySource = useMemo(() => {
    return filteredSkills.filter(skill => (skill.sources ?? []).includes(selectedSource));
  }, [filteredSkills, selectedSource]);

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
    return skills.find((s) => s.id === detailSkill.id) ?? detailSkill;
  }, [skills, detailSkill]);


  // Esc：删除确认优先于技能详情关闭
  useEffect(() => {
    if (!showDetailModal && !deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) {
        e.preventDefault();
        setDeleteTarget(null);
        setDeleteTargetFromRoot(false);
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

  const { isDragOver, importing } = useDragDrop(useCallback(async (importedNames: string[]) => {
    // 拖拽导入后新技能只会存在于根目录，切回根目录 tab 避免用户停留在其他 source tab 时误以为没导入成功
    setSelectedSource(SOURCE.Global);
    // 若用户当前处在"仅启用/仅禁用"过滤下，新导入的技能可能被过滤掉（通常未启用任何 agent），
    // 重置成 All 保证能立刻看到结果。
    if (filterTypeRef.current !== FILTER_TYPE.All) {
      setFilterType(FILTER_TYPE.All);
    }
    // 关键：必须等 refresh 真正落地后再 setSearchTerm，否则搜索会在旧 skills 列表上跑，
    // 出现"提示已安装 / 成功但搜不到，右键刷新才出现"的竞态。
    await refreshSkills();
    if (importedNames.length === 1) {
      setSearchTerm(importedNames[0]);
    }
  }, [refreshSkills, setSearchTerm, setFilterType]));
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

  const handleDeleteConfirm = async (selected: SkillDeletionRow[]) => {
    setDeleteTarget(null);
    setDeleteTargetFromRoot(false);
    handleCloseDetailModal();

    const succeeded: string[] = [];
    const failed: string[] = [];
    for (const row of selected) {
      try {
        await handleDeleteSkill(row.skill, row.source, true);
        succeeded.push(sourceDisplayName(row.source));
      } catch {
        failed.push(sourceDisplayName(row.source));
      }
    }

    const name = selected[0]?.skill.name ?? '';
    if (succeeded.length > 0) {
      showToast('success', t('dashboard.toast.skillDeletedFrom', { name, sources: succeeded.join('、') }));
    }
    if (failed.length > 0) {
      showToast('error', t('dashboard.toast.skillDeleteFromFailed', { name, sources: failed.join('、') }));
    }

    // 多源删除场景下，单次删除后合并记录可能仍然存在（还剩其它源），
    // 所以 handleDeleteSkill 已不再做乐观移除 —— 这里统一拉一次后端真实状态。
    await refreshSkills();
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
            <button
              ref={logButtonRef}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              onClick={toggleLogPopover}
              title={t('dashboard.operationLog.title')}
            >
              <span className="material-symbols-outlined material-symbols-legacy text-lg text-slate-500 dark:text-gray-400">history</span>
              <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
                {t('dashboard.operationLog.title')}
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
              {flatSkills.length === 0 ? (
                <EmptyView message={searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')} />
              ) : (
                <div className="flex gap-4 items-start">
                  {flatColumns.map((col, colIdx) => (
                    <div key={colIdx} className="flex-1 min-w-0 space-y-4">
                      {col.map((s) => (
                        <SkillCard
                          key={s.id}
                          skill={s}
                          agents={agents}
                          expanded={expandedCards.has(s.id)}
                          onToggleExpand={() => toggleExpand(s.id)}
                          onToggleSkill={handleToggleSkillMerged}
                          onToggleAgent={handleToggleAgentMerged}
                          onShowDetail={handleShowSkillDetail}
                        />
                      ))}
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
                  <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-4 h-4 flex-shrink-0" />
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
                      key: `${skill.id}:${selectedSource}`,
                      skill,
                      onInfo: () => {
                        if (originalSkill) handleShowSkillDetail(originalSkill);
                      },
                    };

                    // 根据不同情况添加按钮props
                    if (selectedSource === SOURCE.Global) {
                      // 情况1：根目录tab → 只提供删除功能
                      return (
                        <MarketplaceSkillCard
                          {...baseProps}
                          onDelete={() => {
                            setDeleteTargetFromRoot(true);
                            setDeleteTarget(originalSkill);
                          }}
                        />
                      );
                    }

                    // 情况2：其他tab (Cursor/agent) → 提供添加功能
                    // 是否已存在于根目录：看合并记录里的 `sources` 是否包含 Global
                    const existsInRoot = skills.some(
                      s => s.id === skill.id && (s.sources ?? []).includes(SOURCE.Global)
                    );

                    return (
                      <MarketplaceSkillCard
                        {...baseProps}
                        onAddToRoot={(skillId) => {
                          console.log(`[DEBUG] 点击拷贝到根目录: ${skill.name} (ID: ${skillId})`);
                          // Schema v2：按 id 查合并后的单条记录，再从 source_paths 取当前 tab 对应的路径
                          const targetSkill = skills.find(s => s.id === skillId);
                          const sourcePath = targetSkill?.source_paths?.[selectedSource];
                          if (targetSkill && sourcePath) {
                            console.log(`[DEBUG] 找到技能:`, targetSkill, 'path:', sourcePath);
                            handleAddToRoot(targetSkill, sourcePath).then(() => {
                              appendOperationLog({
                                type: 'copyFromSource',
                                skillName: targetSkill.name,
                                source: selectedSource,
                              });
                              console.log(`[DEBUG] 拷贝完成，刷新中...`);
                              refreshSkills().then(() => {
                                console.log(`[DEBUG] 刷新完成`);
                              });
                            });
                          } else {
                            console.error(`[DEBUG] 未找到技能或源路径: id=${skillId}, source=${selectedSource}`);
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
          onToggleAgent={handleToggleAgentMerged}
          onDelete={((detailSkillLive.sources ?? []).includes(SOURCE.Global) || advancedMode) ? () => {
            setDeleteTargetFromRoot(false);
            setDeleteTarget(detailSkillLive);
          } : undefined}
          onResizeStart={handleMouseDown}
        />
      )}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        rows={
          deleteTarget && !deleteTargetFromRoot
            ? expandToSourceRows(deleteTarget)  // 详情触发：按 sources 展开多选
            : undefined  // 根目录 tab 卡片触发：Modal 内部兜底成单条 global 行
        }
        purpose={deleteTargetFromRoot ? 'root-only' : 'multi-source'}
        advancedMode={advancedMode}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteTargetFromRoot(false);
        }}
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
                    <div className="border-t border-slate-200/70 dark:border-dark-border/60 pt-2">
                      <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.mainToggleHelp.title')}</p>
                      <div className="space-y-1.5">
                        {MAIN_TOGGLE_STATES.map(state => (
                          <div key={state} className="flex items-center gap-2.5">
                            <MainToggleIndicator state={state} />
                            <span className="flex-1 truncate">{t(`dashboard.mainToggleHelp.${state}`)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

      {logPopoverAnchor && (
        <OperationLogPopover anchorRect={logPopoverAnchor} onClose={() => setLogPopoverAnchor(null)} />
      )}
    </div>
  );
}

export default Dashboard;
