import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentConfig, SkillMetadata } from '@/types';
import { SkillDetailInline } from '@/pages/Dashboard/components/SkillDetailInline';

interface DashboardDetailPanelProps {
  showDetailModal: boolean;
  detailSkill: SkillMetadata | null;
  agents: AgentConfig[];
  skillFiles: any[];
  loadingFiles: boolean;
  expandedFolders: Set<string>;
  currentFile: { path: string; content: string } | null;
  loadingFile: boolean;
  leftPanelWidth: number;
  isResizing: boolean;
  onCloseDetailModal: () => void;
  toggleFolder: (path: string) => void;
  handleReadFile: (filePath: string) => void;
  handleToggleAgentMerged: (skill: SkillMetadata, agent: string) => void;
  setDeleteTargetFromRoot: (fromRoot: boolean) => void;
  setDeleteTarget: (skill: SkillMetadata | null) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
}

const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 900;

export const DashboardDetailPanel: React.FC<DashboardDetailPanelProps> = ({
  showDetailModal,
  detailSkill,
  agents,
  skillFiles,
  loadingFiles,
  expandedFolders,
  currentFile,
  loadingFile,
  leftPanelWidth,
  isResizing,
  onCloseDetailModal,
  toggleFolder,
  handleReadFile,
  handleToggleAgentMerged,
  setDeleteTargetFromRoot,
  setDeleteTarget,
  handleMouseDown,
}) => {
  const isOpen = !!(showDetailModal && detailSkill);

  // ---- 可拖拽宽度 ----
  const [panelWidth, setPanelWidth] = useState(500);
  const [isDragging, setIsDragging] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    document.body.classList.add('resizing');
    const startX = e.clientX;
    const startWidth = panelWidthRef.current;
    const handleMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, startWidth + delta)));
    };
    const handleUp = () => {
      setIsDragging(false);
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

  // ---- 关闭动画期间保持内容挂载 ----
  const [panelMounted, setPanelMounted] = useState(isOpen);
  const lastSkillRef = useRef(detailSkill);
  if (detailSkill) lastSkillRef.current = detailSkill;

  useEffect(() => {
    if (isOpen) setPanelMounted(true);
  }, [isOpen]);

  return (
    <div
      className={`overflow-hidden flex-shrink-0 bg-white dark:bg-dark-bg-card flex flex-row min-h-0 ${
        !isDragging ? 'drawer-width-transition' : ''
      }`}
      style={{ width: isOpen ? panelWidth : 0 }}
      onTransitionEnd={(e) => {
        if (e.propertyName === 'width' && !isOpen) setPanelMounted(false);
      }}
    >
      {/* 左侧拖拽线 */}
      {panelMounted && (
        <div
          className={`flex-shrink-0 w-1.5 cursor-col-resize resizable-divider flex flex-col items-center justify-center group border-r border-[#e1e3e4] dark:border-dark-border ${
            isDragging
              ? 'bg-[#b71422]'
              : 'bg-gray-100 dark:bg-dark-bg-secondary hover:bg-[#b71422] dark:hover:bg-[#b71422]'
          }`}
          onMouseDown={handleResizeStart}
        >
          <div className="flex flex-col gap-0.5">
            <div className={`w-0.5 h-1.5 rounded-full transition-colors ${isDragging ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-white'}`} />
            <div className={`w-0.5 h-1.5 rounded-full transition-colors ${isDragging ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-white'}`} />
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {panelMounted && (
          <SkillDetailInline
            skill={(detailSkill ?? lastSkillRef.current)!}
            agents={agents}
            skillFiles={skillFiles}
            loadingFiles={loadingFiles}
            expandedFolders={expandedFolders}
            currentFile={currentFile}
            loadingFile={loadingFile}
            leftPanelWidth={leftPanelWidth}
            isResizing={isResizing}
            onClose={onCloseDetailModal}
            onToggleFolder={toggleFolder}
            onReadFile={handleReadFile}
            onToggleAgent={handleToggleAgentMerged}
            onDelete={() => {
              setDeleteTargetFromRoot(false);
              setDeleteTarget(detailSkill ?? lastSkillRef.current);
            }}
            onResizeStart={handleMouseDown}
          />
        )}
      </div>
    </div>
  );
};
