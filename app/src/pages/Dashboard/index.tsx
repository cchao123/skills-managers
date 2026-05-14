import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';
import type { SkillMetadata } from '@/types';
import { SESSION_STORAGE_KEYS } from '@/constants';
import { FILTER_TYPE } from '@/pages/Dashboard/constants/filterType';
import { SOURCE, isSource } from '@/pages/Dashboard/utils/source';
import { sortAgentsByStoredOrder } from '@/lib/agentOrder';
import { skillsApi } from '@/api/tauri';
import { useHiddenAgents } from '@/hooks/useHiddenAgents';
import { useSidebar } from '@/contexts/SidebarContext';

// Hooks
import { useSkillData } from '@/pages/Dashboard/hooks/useSkillData';
import { useSkillFilters } from '@/pages/Dashboard/hooks/useSkillFilters';
import { usePrefixFilteredSkills } from '@/pages/Dashboard/hooks/usePrefixFilteredSkills';
import { useSkillActions } from '@/pages/Dashboard/hooks/useSkillActions';
import { useSkillModal } from '@/pages/Dashboard/hooks/useSkillModal';
import { useDragDrop } from '@/pages/Dashboard/hooks/useDragDrop';
import { usePanelResize } from '@/pages/Dashboard/hooks/usePanelResize';
import { useDashboardState } from '@/pages/Dashboard/hooks/useDashboardState';
import { useFilteredSkills } from '@/pages/Dashboard/hooks/useFilteredSkills';

// Layout Components
import {
  DashboardSidebar,
  DashboardMain,
  DashboardModals,
  DashboardFloatingActions,
} from '@/pages/Dashboard/components/DashboardLayout';
import { ResizableDetailLayout } from '@/components/ResizableDetailLayout';
import { SkillDetailInline } from '@/pages/Dashboard/components/SkillDetailInline';

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
    return src && isSource(src) ? src : SOURCE.All;
  } catch {
    return SOURCE.All;
  }
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
  const { isCollapsed: isSidebarCollapsed, setIsCollapsed } = useSidebar();
  const [previousSidebarState, setPreviousSidebarState] = useState<boolean>(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMainScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 1000);
  }, []);

  // 核心状态管理
  const dashboardState = useDashboardState();
  const {
    expandedCards,
    setExpandedCards,
    showImportModal,
    setShowImportModal,
    helpPopover,
    setHelpPopover,
    helpButtonRef,
    cardContextMenu,
    setCardContextMenu,
    pinnedIds,
    logPopoverAnchor,
    setLogPopoverAnchor,
    logButtonRef,
    handleCardContextMenu,
    handleTogglePin,
    handleLogClick,
  } = dashboardState;

  const [selectedSource, setSelectedSource] = useState<string>(() => readPersistedSelectedSource());

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

  // 只展示"可见 agent"的技能：排除 sources 全属于隐藏 agent 的技能
  const hiddenAgents = useHiddenAgents();
  const visibleSkills = useMemo(() => {
    if (hiddenAgents.size === 0) return skills;
    return skills.filter(skill =>
      skill.sources.some(src => src === 'global' || !hiddenAgents.has(src))
    );
  }, [skills, hiddenAgents]);

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

  const { searchTerm, setSearchTerm, filterType, setFilterType, filteredSkills } = useSkillFilters(visibleSkills);
  const filterTypeRef = useRef(filterType);
  filterTypeRef.current = filterType;
  const prefixFilteredSkills = usePrefixFilteredSkills(visibleSkills);
  const { handleToggleSkillMerged, handleToggleAgentMerged, handleDeleteSkill } = useSkillActions(skills, setSkills, agents);

  // 按来源展示过滤：使用自定义 hook 简化逻辑
  const filteredBySource = useFilteredSkills(filteredSkills, selectedSource, pinnedIds);

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

  // 关闭动画期间维持最后一个技能快照，供面板继续渲染
  const lastSkillRef = useRef<SkillMetadata | null>(null);
  if (detailSkillLive) lastSkillRef.current = detailSkillLive;

  // 详情面板打开时，自动收起侧边栏
  useEffect(() => {
    const hasDrawerOpen = showDetailModal && detailSkillLive;
    if (hasDrawerOpen && !isSidebarCollapsed) {
      setPreviousSidebarState(isSidebarCollapsed);
      setIsCollapsed(true);
    } else if (!hasDrawerOpen && !previousSidebarState && isSidebarCollapsed) {
      setIsCollapsed(false);
      setPreviousSidebarState(true);
    }
  }, [showDetailModal, detailSkillLive, isSidebarCollapsed, previousSidebarState, setIsCollapsed]);

  // 侧边栏展开时，关闭详情面板
  useEffect(() => {
    if (!isSidebarCollapsed) {
      if (showDetailModal) handleCloseDetailModal();
    }
  }, [isSidebarCollapsed]);

  const { isDragOver, importing } = useDragDrop(useCallback(async (importedNames: string[], targetSource: string) => {
    // 切换到实际导入目标的 tab（根目录或选中的 agent）
    setSelectedSource(targetSource);
    if (filterTypeRef.current !== FILTER_TYPE.All) {
      setFilterType(FILTER_TYPE.All);
    }
    await refreshSkills();
    if (importedNames.length === 1) {
      setSearchTerm(importedNames[0]);
    }
  }, [refreshSkills, setSearchTerm, setFilterType]), selectedSource);

  const { leftPanelWidth, isResizing, handleMouseDown } = usePanelResize();

  // Handlers
  const toggleExpand = useCallback((cardKey: string) => {
    setExpandedCards(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(cardKey)) {
        newExpanded.delete(cardKey);
      } else {
        newExpanded.add(cardKey);
      }
      return newExpanded;
    });
  }, []);

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
        await skillsApi.copyToAgent(skill.id, sourceAgent, targetAgent, defaultEnabled);
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
              <div className="text-3xl text-red-600 dark:text-red-400">❌</div>
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
      <ResizableDetailLayout
        isPanelOpen={!!(showDetailModal && detailSkillLive)}
        className="flex-1 min-h-0"
        panel={
          <SkillDetailInline
            skill={(detailSkillLive ?? lastSkillRef.current)!}
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
            onDeleteSuccess={refreshSkills}
            onResizeStart={handleMouseDown}
          />
        }
      >
        <DashboardMain
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterType={filterType}
          onFilterChange={setFilterType as any}
          prefixFilteredSkills={prefixFilteredSkills}
          agents={agents}
          selectedSource={selectedSource}
          filteredBySource={filteredBySource}
          expandedCards={expandedCards}
          onToggleExpand={toggleExpand}
          onToggleSkill={handleToggleSkillMerged}
          onToggleAgent={handleToggleAgentMerged}
          onShowDetail={handleShowSkillDetail}
          pinnedIds={pinnedIds}
          onContextMenu={handleCardContextMenu}
          onOpenImportModal={() => setShowImportModal(true)}
          isDragOver={isDragOver}
          importing={importing}
          showDetailModal={showDetailModal}
          detailSkill={detailSkillLive}
          skills={skills}
          onMainScroll={handleMainScroll}
          sidebar={
            <DashboardSidebar
              agents={agents}
              selectedSource={selectedSource}
              onSourceSelect={setSelectedSource}
              filteredSkills={filteredSkills}
              displayedSkillCount={filteredBySource.length}
              totalFilteredCount={filteredSkills.length}
              searchTerm={searchTerm}
              filterType={filterType}
            />
          }
        />
      </ResizableDetailLayout>

      {/* Modals */}
      <DashboardModals
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        agents={agents}
        selectedSource={selectedSource}
        skills={skills}
        filteredBySource={filteredBySource}
        handleImportSkills={handleImportSkills}
        logPopoverAnchor={logPopoverAnchor}
        setLogPopoverAnchor={setLogPopoverAnchor}
        helpPopover={helpPopover}
        setHelpPopover={setHelpPopover}
        cardContextMenu={cardContextMenu}
        setCardContextMenu={setCardContextMenu}
        pinnedIds={pinnedIds}
        handleTogglePin={handleTogglePin}
      />

      {/* Floating Actions */}
      <DashboardFloatingActions
        helpButtonRef={helpButtonRef}
        onHelpClick={handleHelpClick}
        logButtonRef={logButtonRef}
        onLogClick={handleLogClick}
        isDrawerOpen={!!(showDetailModal && detailSkillLive)}
        isScrolling={isScrolling}
      />
    </div>
  );
}

export default Dashboard;
