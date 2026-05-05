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
    <>
      <div className="inline-flex items-center gap-2 px-1 py-1 bg-[#f5f5f5] dark:bg-dark-bg rounded-lg">
        {tabs.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && (
              <div className="w-px h-3 bg-slate-300 dark:bg-dark-bg-tertiary shrink-0" />
            )}
            <button
              onClick={() => onSelect(item.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ open: true, x: e.clientX, y: e.clientY, sourceId: item.id });
              }}
              className={`flex items-center gap-1.5 transition-all rounded-md px-2 py-1.5 whitespace-nowrap ${
                selectedSource === item.id
                  ? 'bg-white dark:bg-dark-bg-card shadow-sm'
                  : 'hover:bg-white/50 dark:hover:bg-dark-bg-card/50'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <img src={item.icon} alt={item.label} className="w-full h-full object-contain" />
              </div>
              <span className={`text-xs font-bold transition-colors ${
                selectedSource === item.id
                  ? 'text-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-gray-300'
              }`}>{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={ctxItems}
        onClose={closeCtxMenu}
      />
    </>
  );
};
