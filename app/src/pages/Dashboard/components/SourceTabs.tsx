import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import { getAgentIcon } from '@/pages/Dashboard/utils/agentHelpers';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { getAgentRootPath } from '@/constants';
import { agentsApi } from '@/api/tauri';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';

interface TabItem {
  id: string;
  label: string;
  icon: string;
}

interface SourceTabsProps {
  agents: AgentConfig[];
  selectedSource: string;
  onSelect: (source: string) => void;
}

interface TabContextMenuState {
  open: boolean;
  x: number;
  y: number;
  sourceId: string | null;
}

/** 解析来源 tab 对应的根目录路径；未知来源返回空串 */
const resolveSourceRoot = (sourceId: string): string =>
  sourceId === SOURCE.Global ? '~/.skills-manager' : getAgentRootPath(sourceId);

export const SourceTabs: React.FC<SourceTabsProps> = ({ agents, selectedSource, onSelect }) => {
  const { t } = useTranslation();
  const visibleAgents = useVisibleAgents(agents);

  const tabs = useMemo<TabItem[]>(() => [
    { id: SOURCE.All, label: t('dashboard.source.all'), icon: OCTOPUS_LOGO_URL },
    { id: SOURCE.Global, label: t('dashboard.source.global'), icon: OCTOPUS_LOGO_URL },
    ...visibleAgents.map(a => ({
      id: a.name,
      label: a.display_name,
      icon: getAgentIcon(a.name),
    })),
  ], [visibleAgents, t]);

  const [ctxMenu, setCtxMenu] = useState<TabContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    sourceId: null,
  });

  const closeCtxMenu = () => setCtxMenu((s) => ({ ...s, open: false }));

  const ctxItems: ContextMenuItem[] = ctxMenu.sourceId
    ? [
        {
          label: t('dashboard.contextMenu.openRoot'),
          icon: 'folder_open',
          onClick: () => {
            const path = resolveSourceRoot(ctxMenu.sourceId!);
            if (path) agentsApi.openFolderPath(path).catch(() => { /* 静默 */ });
          },
        },
      ]
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* 侧边栏背景 */}
      <div className="flex-1 w-16 bg-white/80 dark:bg-dark-bg-card/80 backdrop-blur-sm border-r border-slate-200/60 dark:border-dark-border flex flex-col items-center py-4 gap-1 overflow-y-auto">
        {tabs.map((item) => {
          const isSelected = selectedSource === item.id;
          const isAll = item.id === SOURCE.All;
          const isGlobal = item.id === SOURCE.Global;
          const showSeparator = isGlobal && visibleAgents.length > 0;

          return (
            <React.Fragment key={item.id}>
              <button
                onClick={() => onSelect(item.id)}
                onContextMenu={(e) => {
                  if (!isAll) {
                    e.preventDefault();
                    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, sourceId: item.id });
                  }
                }}
                className="relative group w-full flex flex-col items-center gap-1.5 py-2.5 px-1 transition-all duration-200"
                title={item.label}
              >
                {/* 左侧选中指示条 */}
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#b71422] dark:bg-[#d9304a]" />
                )}

                {/* 背景悬停效果 */}
                <div className={`absolute inset-x-1 inset-y-1.5 rounded-lg transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#f5f5f5] dark:bg-white/5'
                    : 'bg-transparent group-hover:bg-slate-100/50 dark:group-hover:bg-white/3'
                }`} />

                {/* 图标和文字 */}
                <div className="relative flex flex-col items-center gap-1.5">
                  {/* 图标容器 */}
                  <div className={`w-7 h-6 flex items-center justify-center transition-all duration-200 ${
                    isSelected ? 'scale-110' : 'scale-100 group-hover:scale-105'
                  }`}>
                    <img
                      src={item.icon}
                      alt={item.label}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* 文字标签 */}
                  <span className={`text-[10px] font-medium transition-all duration-200 max-w-[3.5rem] truncate px-0.5 ${
                    isSelected
                      ? 'text-[#b71422] dark:text-[#f86a7d] font-semibold'
                      : 'text-slate-500 dark:text-gray-400 group-hover:text-slate-600 dark:group-hover:text-gray-300'
                  }`}>
                    {item.label}
                  </span>
                </div>

                {/* 选中状态的外边框 */}
                {isSelected && (
                  <div className="absolute inset-x-1 inset-y-1.5 rounded-lg border border-[#b71422]/20 dark:border-[#d9304a]/20 pointer-events-none" />
                )}
              </button>

              {/* 分隔线 */}
              {showSeparator && (
                <div key="separator" className="w-8 h-px bg-slate-200 dark:bg-dark-border my-1" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 右键菜单 */}
      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={ctxItems}
        onClose={closeCtxMenu}
      />
    </div>
  );
};
