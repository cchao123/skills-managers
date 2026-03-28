import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import type { SkillMetadata } from '../../types';
import { TabSwitcher } from '../../components/TabSwitcher';

// Hooks
import { useSkillData } from './hooks/useSkillData';
import { useSkillFilters } from './hooks/useSkillFilters';
import { useSkillActions } from './hooks/useSkillActions';
import { useSkillModal } from './hooks/useSkillModal';
import { useDragDrop } from './hooks/useDragDrop';
import { usePanelResize } from './hooks/usePanelResize';

// Components
import { SkillCard } from './components/SkillCard';
import { SearchAndFilterBar } from './components/SearchAndFilterBar';
import { DragDropOverlay } from './components/DragDropOverlay';
import { ImportingOverlay } from './components/ImportingOverlay';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { SkillDetailModal } from './components/SkillDetailModal';
import { getSkillIcon, getSkillColor } from './utils/skillHelpers';
import MarketplaceSkillCard from './components/MarketplaceSkillCard';
import type { Skill } from '../../types/skills';

function Dashboard() {
  const { t } = useTranslation();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SkillMetadata | null>(null);
  const [viewMode, setViewMode] = useState('flat');
  const [selectedAgent, setSelectedAgent] = useState<string>('All');

  const viewTabs = [
    { id: 'flat', label: '平铺展示', icon: 'grid_view' },
    { id: 'agent', label: '按agent展示', icon: 'view_list' },
  ];

  // 切换视图时重置agent选择
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    if (mode === 'agent') {
      setSelectedAgent('All');
    }
  };

  // Custom hooks
  const { skills, setSkills, agents, loading, error, loadSkills } = useSkillData();
  const { searchTerm, setSearchTerm, filterType, setFilterType, filteredSkills } = useSkillFilters(skills);
  const { handleToggleSkill, handleToggleAgent, handleDeleteSkill } = useSkillActions(skills, setSkills);

  // 将SkillMetadata转换为Marketplace的Skill格式
  const convertToMarketplaceSkill = (skill: SkillMetadata): Skill => {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version || '1.0.0',
      category: 'Skill',
      icon: getSkillIcon(skill.id),
      iconColor: getSkillColor(skill.id),
      rating: 4.5,
      downloads: '1k',
      author: 'Skills Manager',
      installed: skill.enabled,
    };
  };

  const marketplaceSkills = filteredSkills.map(convertToMarketplaceSkill);

  // 根据选中的agent筛选技能
  const filteredByAgent = selectedAgent === 'All'
    ? marketplaceSkills
    : marketplaceSkills.filter(skill => {
        const originalSkill = filteredSkills.find(s => s.id === skill.id);
        return originalSkill?.agent_enabled[selectedAgent];
      });
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
  const { isDragOver, importing } = useDragDrop();
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
        actions={<TabSwitcher tabs={viewTabs} activeTab={viewMode} onTabChange={handleViewModeChange} />}
      />

      <div className="flex-1 overflow-y-auto bg-white/80 dark:bg-dark-bg-secondary p-8">
        {/* Search and Filter Section */}
        <div className="max-w-6xl mx-auto mb-6">
          <SearchAndFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onFilterChange={setFilterType}
            skills={skills}
            viewMode={viewMode}
            selectedAgent={selectedAgent}
            onAgentSelect={setSelectedAgent}
            agents={agents}
          />
        </div>

        {viewMode === 'flat' && (
          <>
            {filteredSkills.length === 0 ? (
              <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
                  search_off
                </span>
                <p className="text-slate-500 dark:text-gray-400 font-medium">
                  {searchTerm ? t('dashboard.search.noResults') : t('dashboard.filter.noResults')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-4 items-start">
                {/* Left column */}
                <div className="flex-1 space-y-4">
                  {filteredSkills.filter((_, i) => i % 2 === 0).map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      agents={agents}
                      expanded={expandedCards.has(skill.id)}
                      onToggleExpand={toggleExpand}
                      onToggleSkill={handleToggleSkill}
                      onToggleAgent={handleToggleAgent}
                      onShowDetail={handleShowSkillDetail}
                    />
                  ))}
                  {/* Small screen: show right column skills here too */}
                  <div className="lg:hidden space-y-4">
                    {filteredSkills.filter((_, i) => i % 2 === 1).map((skill) => (
                      <SkillCard
                        key={skill.id}
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
                {/* Right column - only on large screens */}
                <div className="flex-1 space-y-4 hidden lg:block">
                  {filteredSkills.filter((_, i) => i % 2 === 1).map((skill) => (
                    <SkillCard
                      key={skill.id}
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
            )}
          </>
        )}

        {viewMode === 'agent' && (
          <div className="bg-[#f8f9fa] dark:bg-dark-bg-secondary">
            <div className="space-y-6">
              {/* Skills Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredByAgent.map((skill) => (
                  <MarketplaceSkillCard
                    key={skill.id}
                    skill={skill}
                    onInstall={() => {
                      const originalSkill = skills.find(s => s.id === skill.id);
                      if (originalSkill) {
                        handleToggleSkill(originalSkill);
                      }
                    }}
                    onInfo={() => handleShowSkillDetail(skills.find(s => s.id === skill.id)!)}
                  />
                ))}
              </div>

              {filteredByAgent.length === 0 && (
                <div className="text-center py-20 text-slate-500 dark:text-gray-400">
                  该 Agent 下暂无技能
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {showDetailModal && detailSkill && (
        <SkillDetailModal
          skill={detailSkill}
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
          onDelete={() => setDeleteTarget(detailSkill)}
          onResizeStart={handleMouseDown}
        />
      )}

      {/* Drag & Drop Overlay */}
      {isDragOver && <DragDropOverlay />}

      {/* Importing Overlay */}
      {importing && <ImportingOverlay />}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default Dashboard;
