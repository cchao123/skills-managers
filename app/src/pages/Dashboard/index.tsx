import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import { useToast } from '@/components/Toast';
import type { SkillMetadata, SkillDeletionRow } from '@/types';
import { SESSION_STORAGE_KEYS } from '@/constants';
import { SourceTabs } from '@/pages/Dashboard/components/SourceTabs';

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
import { SearchAndFilterBar } from '@/pages/Dashboard/components/SearchAndFilterBar';
import { DragDropOverlay } from '@/pages/Dashboard/components/DragDropOverlay';
import { ImportingOverlay } from '@/pages/Dashboard/components/ImportingOverlay';
import { DeleteConfirmModal } from '@/pages/Dashboard/components/DeleteConfirmModal';
import { EmptyView } from '@/pages/Dashboard/components/EmptyView';
import { PlusCard } from '@/pages/Dashboard/components/PlusCard';
import { SkillImportModal } from '@/pages/Dashboard/components/SkillImportModal';
import { SkillDetailInline } from '@/pages/Dashboard/components/SkillDetailInline';
import { CardContextMenu } from '@/pages/Dashboard/components/CardContextMenu';
import { skillsApi, pinApi } from '@/api/tauri';
import { SOURCE, sourceDisplayName, isSource } from '@/pages/Dashboard/utils/source';
import { sortAgentsByStoredOrder } from '@/lib/agentOrder';

import { Icon } from '@/components/Icon';

// 添加抽屉动画样式
if (typeof document !== 'undefined' && !document.getElementById('dashboard-drawer-animation')) {
  const style = document.createElement('style');
  style.id = 'dashboard-drawer-animation';
  style.textContent = `
    .drawer-width-transition {
      transition: width 0.3s ease-out, flex 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}

function readPersistedSelectedSource(): string {
  try {
    const src = sessionStorage.getItem(SESSION_STORAGE_KEYS.dashboardSelectedSourceV2);
    return isSource(src) ? src : SOURCE.All;
  } catch {
    return SOURCE.All;
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
  isActive = true,
}: {
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
  /** 跨 Agent 技能导入弹窗状态 */
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>(() => readPersistedSelectedSource());

  // Agent 筛选状态
  const [selectedAgentsFilter, setSelectedAgentsFilter] = useState<Set<string>>(new Set());

  /** 帮助气泡挂 Portal：与 Toast 一样在 body 层 fixed，backdrop-blur 才能作用到整窗，否则会透出下层 Tab 等 */
  const [helpPopover, setHelpPopover] = useState<{ open: boolean; anchor: DOMRect | null }>({
    open: false,
    anchor: null,
  });
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  // 卡片右键上下文菜单 + 置顶 skill 列表
  const [cardContextMenu, setCardContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    skillId: string | null;
  }>({ open: false, x: 0, y: 0, skillId: null });
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    pinApi
      .list()
      .then((ids) => {
        if (!cancelled) setPinnedIds(new Set(ids));
      })
      .catch(() => {
        // 在浏览器预览（非 Tauri）下静默失败即可
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const handleCardContextMenu = useCallback(
    (skillId: string, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      setCardContextMenu({ open: true, x: e.clientX, y: e.clientY, skillId });
    },
    []
  );
  const handleTogglePin = useCallback((skillId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      const willPin = !next.has(skillId);
      if (willPin) next.add(skillId);
      else next.delete(skillId);
      pinApi.setPinned(skillId, willPin).catch((err) => {
        console.error('[pin] failed:', err);
        setPinnedIds(prev);
      });
      return next;
    });
  }, []);

  // 操作日志 popover
  const [logPopoverAnchor, setLogPopoverAnchor] = useState<DOMRect | null>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);
  const handleLogClick = useCallback(() => {
    if (logPopoverAnchor) {
      setLogPopoverAnchor(null);
    } else {
      const rect = logButtonRef.current?.getBoundingClientRect();
      if (rect) setLogPopoverAnchor(rect);
    }
  }, [logPopoverAnchor]);

  // 离开再进入 Dashboard（如去 GitHub 备份页）时保留来源 Tab：写入 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.dashboardSelectedSourceV2, selectedSource);
    } catch {
      /* ignore quota / private mode */
    }
  }, [selectedSource]);

  // Custom hooks
  const { skills, setSkills, agents: rawAgents, loading, error, loadSkills, refreshSkills, loadAgents } = useSkillData();
  const agents = useMemo(() => sortAgentsByStoredOrder(rawAgents), [rawAgents]);

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

  const handleHelpClick = () => {
    if (helpPopover.open) {
      setHelpPopover({ open: false, anchor: null });
    } else {
      const el = helpButtonRef.current;
      const anchor = el ? el.getBoundingClientRect() : null;
      setHelpPopover({ open: true, anchor });
    }
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

  const { searchTerm, setSearchTerm, filterType, setFilterType, filteredSkills } = useSkillFilters(skills);
  const filterTypeRef = useRef(filterType);
  filterTypeRef.current = filterType;
  const prefixFilteredSkills = usePrefixFilteredSkills(skills);
  const { handleToggleSkillMerged, handleToggleAgentMerged, handleDeleteSkill } = useSkillActions(skills, setSkills, agents);

  /**
   * 平铺视图：后端已按 id 合并；
   * 1) pinned 优先；
   * 2) 按 id 稳定排序。
   * 3) 根据 selectedAgentsFilter 过滤 Agent
   */
  const flatSkills = useMemo(() => {
    let skills = [...filteredSkills];

    // 根据 selectedAgentsFilter 过滤
    if (selectedAgentsFilter.size > 0) {
      skills = skills.filter(skill => {
        // 如果技能有 sources 属性，检查是否包含任何选中的 Agent
        if (skill.sources && skill.sources.length > 0) {
          return skill.sources.some(source => selectedAgentsFilter.has(source));
        }
        // 如果没有 sources，检查是否在 Global 中（如果没有选中任何 Agent，则显示）
        return selectedAgentsFilter.has(SOURCE.Global);
      });
    }

    return skills.sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1;
      const bp = pinnedIds.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.id.localeCompare(b.id);
    });
  }, [filteredSkills, pinnedIds, selectedAgentsFilter]);

  // 按来源展示过滤：Schema v2 中一条 skill 可能分布在多个源里，
  // 只要 `sources` 包含当前选中源就展示。下游组件按 `selectedSource` 定位当前 tab。
  // 排序：pinned 优先（保持其它过滤后的相对顺序）。
  const filteredBySource = useMemo(() => {
    // All: 显示所有技能
    if (selectedSource === SOURCE.All) {
      return [...filteredSkills].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 0 : 1;
        const bp = pinnedIds.has(b.id) ? 0 : 1;
        return ap - bp;
      });
    }
    // 其他来源：只显示包含该来源的技能
    const list = filteredSkills.filter(skill => (skill.sources ?? []).includes(selectedSource));
    return [...list].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1;
      const bp = pinnedIds.has(b.id) ? 0 : 1;
      return ap - bp;
    });
  }, [filteredSkills, selectedSource, pinnedIds]);
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

  // 处理跨 Agent 技能导入
  const handleImportSkills = async (importedSkills: SkillMetadata[], defaultEnabled: boolean) => {
    try {
      const targetAgent = selectedSource;

      for (const skill of importedSkills) {
        // 找到该技能在源 Agent 中的路径
        const sourceAgent = skill.sources.find(s => s !== SOURCE.Global && s !== targetAgent);

        if (!sourceAgent) {
          console.warn(`技能 ${skill.name} 没有找到有效的源 Agent`);
          continue;
        }

        // 调用复制 API
        const result = await skillsApi.copyToAgent(skill.id, sourceAgent, targetAgent, defaultEnabled);
        console.log(`成功复制技能: ${result}`);
      }

      showToast(
        'success',
        t('dashboard.toast.importSkillsSuccess', { count: importedSkills.length })
      );

      // 导入后刷新技能列表
      await refreshSkills();
    } catch (error) {
      console.error('导入失败:', error);
      showToast('error', t('common.error'));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col" data-tauri-drag-region>
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
      <div className="h-full flex flex-col" data-tauri-drag-region>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white dark:bg-dark-bg-card rounded-xl p-6 border border-red-200 dark:border-red-900/30 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="error" className="text-3xl text-red-600 dark:text-red-400" />
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
    <div className="h-full flex overflow-hidden">
      <SourceTabs
        agents={agents}
        selectedSource={selectedSource}
        onSelect={setSelectedSource}
      />
      <div className="flex-1 min-w-0 min-h-0 flex">
          {/* 主内容区 */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
              {/* 搜索栏 - 固定；overflow-visible 供统计条 hover 气泡向上伸出
              原 PageHeader 已移除，此处增加 data-tauri-drag-region 以保留窗口拖拽 */}
              <div
                className="overflow-visible bg-[#f8f9fa] dark:bg-dark-bg-secondary pr-5 pt-5 pb-4"
                data-tauri-drag-region
              >
                <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl">
                  <SearchAndFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterType={filterType}
                    onFilterChange={setFilterType}
                    skills={prefixFilteredSkills}
                    agents={agents}
                    selectedSource={selectedSource}
                    onSourceSelect={setSelectedSource}
                  />
                </div>
              </div>

              {/* 内容区域 - 可滚动；底部加 pb-6 防止最后一行卡片贴到窗口底边 */}
              <div className={`relative flex-1 flex flex-col overflow-hidden bg-[#f8f9fa] dark:bg-dark-bg-secondary ${isDragOver ? 'px-0 border-4 border-[#b71422] bg-white/90 dark:bg-dark-bg-primary rounded-xl mx-5' : 'px-5 pl-0'}`}>
                <div className="flex-1 overflow-y-auto pb-6">

            <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto">
              {filteredBySource.length === 0 ? (
                <EmptyView message={searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')} />
              ) : (
                <div className={`grid gap-4 transition-all duration-300 ${
                  showDetailModal && detailSkillLive
                    ? 'grid-cols-1 xl:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                }`}>
                  {/* Plus Card - 放在最前面 */}
                  <PlusCard
                    agents={agents}
                    currentAgent={selectedSource}
                    onOpen={() => setShowImportModal(true)}
                  />

                  {/* Skills */}
                  {filteredBySource.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      agents={agents}
                      expanded={expandedCards.has(skill.id)}
                      onToggleExpand={() => toggleExpand(skill.id)}
                      onToggleSkill={handleToggleSkillMerged}
                      onToggleAgent={handleToggleAgentMerged}
                      onShowDetail={handleShowSkillDetail}
                      pinned={pinnedIds.has(skill.id)}
                      onContextMenu={(e) => handleCardContextMenu(skill.id, e)}
                    />
                  ))}
                </div>
              )}
            </div>
            </div>
            {/* Drag & Drop Overlay */}
            {isDragOver && <DragDropOverlay />}

            {/* Importing Overlay */}
            {importing && <ImportingOverlay />}
          </div>
      </div>

      {/* 右边：详情面板（内联显示） */}
      <div className={`overflow-hidden flex-shrink-0 bg-white dark:bg-dark-bg-card border-l border-[#e1e3e4] dark:border-dark-border flex flex-col min-h-0 relative drawer-width-transition ${showDetailModal && detailSkillLive ? 'w-[500px]' : 'w-0 border-none'
        }`}>
        {showDetailModal && detailSkillLive && (
          <>
            <SkillDetailInline
              skill={detailSkillLive}
              agents={agents}
              skillFiles={skillFiles}
              loadingFiles={loadingFiles}
              expandedFolders={expandedFolders}
              currentFile={currentFile}
              loadingFile={loadingFile}
              leftPanelWidth={leftPanelWidth}
              isResizing={isResizing}
              onClose={() => {
                handleCloseDetailModal();
              }}
              onToggleFolder={toggleFolder}
              onReadFile={handleReadFile}
              onToggleAgent={handleToggleAgentMerged}
              onDelete={() => {
                setDeleteTargetFromRoot(false);
                setDeleteTarget(detailSkillLive);
              }}
              onResizeStart={handleMouseDown}
            />
          </>
        )}
      </div>
      </div>


      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        rows={
          deleteTarget && !deleteTargetFromRoot
            ? expandToSourceRows(deleteTarget)  // 详情触发：按 sources 展开多选
            : undefined  // 根目录 tab 卡片触发：Modal 内部兜底成单条 global 行
        }
        purpose={deleteTargetFromRoot ? 'root-only' : 'multi-source'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteTargetFromRoot(false);
        }}
      />

      {/* Skill Import Modal */}
      {showImportModal && (
        <SkillImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          agents={agents}
          currentAgent={selectedSource}
          allSkills={skills}
          currentAgentSkills={filteredBySource}
          onImport={handleImportSkills}
        />
      )}

      {helpPopover.open &&
        helpPopover.anchor &&
        (() => {
          const rect = helpPopover.anchor as DOMRect;
          const vw = window.innerWidth;
          const width = Math.min(352, vw - 16);
          let left = rect.right - width;
          left = Math.max(8, Math.min(left, vw - width - 8));
          return createPortal(
            <>
              <div
                onMouseDown={() => setHelpPopover({ open: false, anchor: null })}
                style={{ position: 'fixed', inset: 0, zIndex: 9997, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              />
              <div
                style={{
                  position: 'fixed',
                  bottom: window.innerHeight - rect.top + 4,
                  left,
                  width,
                  zIndex: 9998,
                }}
                className="pointer-events-auto"
              >
                <div
                  className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} !flex-col max-h-[min(70vh,28rem)] overflow-hidden p-4 animate-toast-in`}
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Icon name="info" className="text-base text-info" />
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('dashboard.viewHelp')}</p>
                  </div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden">
                    <div className="space-y-3 text-xs leading-normal text-slate-500 dark:text-gray-400 text-left">
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 dark:text-gray-200">
                          <Icon name="grid_view" className="text-base text-slate-500 dark:text-gray-400" />
                          {t('dashboard.viewFlat')}
                        </p>
                        <p>{t('dashboard.viewHelpFlat')}</p>
                      </div>
                      <div>
                        <p className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 dark:text-gray-200">
                          <Icon name="smart_toy" className="text-base text-slate-500 dark:text-gray-400" />
                          {t('dashboard.viewBySource')}
                        </p>
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
                      <div className="border-t border-slate-200/70 dark:border-dark-border/60 pt-2">
                        <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.pinHelp.title')}</p>
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="relative w-9 h-5 rounded-md overflow-hidden border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-bg-card flex-shrink-0"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 30 30"
                              className="absolute top-0 left-0"
                            >
                              <polygon points="0,0 30,0 0,30" className="fill-[#fee2e2] dark:fill-[#7f1d1d]" />
                              <polygon points="0,0 20,0 0,20" className="fill-[#f87171] dark:fill-[#dc2626]" />
                              <polygon points="0,0 10,0 0,10" className="fill-[#b71422] dark:fill-[#fca5a5]" />
                            </svg>
                          </span>
                          <span className="flex-1">{t('dashboard.pinHelp.desc')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>,
            document.body
          );
        })()}

      {logPopoverAnchor && (
        <OperationLogPopover
          anchorRect={logPopoverAnchor}
          onClose={() => setLogPopoverAnchor(null)}
          openAbove
        />
      )}

      <CardContextMenu
        open={cardContextMenu.open}
        x={cardContextMenu.x}
        y={cardContextMenu.y}
        onClose={() => setCardContextMenu((s) => ({ ...s, open: false }))}
        pinned={!!cardContextMenu.skillId && pinnedIds.has(cardContextMenu.skillId)}
        onTogglePin={() => {
          if (cardContextMenu.skillId) handleTogglePin(cardContextMenu.skillId);
        }}
      />

      {/* 右下角浮动操作按钮 */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40">
        <div className="relative group">
          <button
            ref={helpButtonRef}
            onClick={handleHelpClick}
            className="w-9 h-9 rounded-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all"
          >
            <Icon name="help" className="text-base text-slate-500 dark:text-gray-400" />
          </button>
          <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:block">
            <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
              {t('dashboard.viewHelp')}
            </div>
          </div>
        </div>
        <div className="relative group">
          <button
            ref={logButtonRef}
            onClick={handleLogClick}
            className="w-9 h-9 rounded-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all"
          >
            <Icon name="history" className="text-base text-slate-500 dark:text-gray-400" />
          </button>
          <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:block">
            <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
              {t('dashboard.operationLog.title')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
