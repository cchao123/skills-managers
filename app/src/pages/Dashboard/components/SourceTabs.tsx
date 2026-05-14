import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AgentConfig, SkillMetadata } from '@/types';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { getAgentRootPath, SESSION_STORAGE_KEYS, ROUTE_PATH } from '@/constants';
import { agentsApi } from '@/api/tauri';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { Icon } from '@/components/Icon';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';
import { TAB_TYPE } from '@/pages/Settings/constants/config';

interface TabItem {
  id: string;
  label: string;
  icon: string;
}

interface SourceTabsProps {
  agents: AgentConfig[];
  selectedSource: string;
  onSelect: (source: string) => void;
  skills: SkillMetadata[];
  displayedSkillCount: number;
  totalFilteredCount: number;
  searchTerm: string;
  filterType: string;
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

export const SourceTabs: React.FC<SourceTabsProps> = ({
  agents,
  selectedSource,
  onSelect,
  skills,
  totalFilteredCount,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const visibleAgents = useVisibleAgents(agents);

  // 计算每个 source 对应的 skills 数量
  const getSkillCount = (sourceId: string): number => {
    if (sourceId === SOURCE.All) {
      // All：显示所有过滤后的技能总数
      return totalFilteredCount;
    }
    if (sourceId === SOURCE.Global) {
      // 根目录技能：sources 数组中包含 'global'
      const globalSkillsCount = skills.filter(skill =>
        skill.sources.includes('global')
      ).length;
      return globalSkillsCount;
    }
    // Agent：显示包含该 agent 的技能数量
    return skills.filter(skill => skill.sources.includes(sourceId)).length;
  };

  const tabs = useMemo<TabItem[]>(() => [
    { id: SOURCE.All, label: 'ALL', icon: '' },
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

  const handleSettingsClick = () => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.settingsInitialTab, TAB_TYPE.Agents);
    } catch {
      /* ignore quota / private mode */
    }
    navigate(ROUTE_PATH.Settings);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 侧边栏背景 */}
      <div className="flex-1 w-11 flex flex-col items-center gap-2 overflow-visible mx-5 mb-5">
        {/* 滑块容器 */}
        <div className="relative flex flex-col items-center w-full rounded-lg bg-gray-100 dark:bg-dark-bg-tertiary">
          {/* 滑动高亮块 */}
          {selectedSource && (() => {
            const selectedIndex = tabs.findIndex((t) => t.id === selectedSource);

            // 每个按钮的实际高度：h-[60px] = 60px
            // 按钮之间没有额外间距（flex gap=0）
            const buttonHeight = 60;
            const containerPaddingTop = 2; // py-0.5 = 2px

            // 计算滑块位置
            const topOffset = containerPaddingTop + (selectedIndex * buttonHeight);

            // 滑块高度略小于按钮高度
            const sliderHeight = buttonHeight - 10;

            return (
              <div
                className="absolute left-0.5 right-0.5 rounded-md bg-white dark:bg-dark-bg-card shadow-sm transition-all duration-200 ease-in-out z-0"
                style={{
                  top: `${topOffset}px`,
                  height: `${sliderHeight}px`,
                }}
              />
            );
          })()}

          {tabs.map((item) => {
            const isSelected = selectedSource === item.id;
            const isAll = item.id === SOURCE.All;

            return (
              <div key={item.id} className="relative z-10 w-full">
                <button
                  onClick={() => {
                    onSelect(item.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, sourceId: item.id });
                  }}
                  className="group w-full flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-all duration-200 h-[60px]"
                  title={item.label}
                >
                  {/* 图标和数量 */}
                  <div className="relative flex flex-col items-center justify-center h-full">
                    {/* ALL 不显示图标，其他显示 */}
                    {isAll ? (
                      <span className={`text-xs font-bold transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'text-slate-700 dark:text-white'
                          : 'text-slate-400 dark:text-gray-500'
                      }`}>
                        {item.label}
                      </span>
                    ) : (
                      <>
                        {/* 图标容器 */}
                        <div className={`w-7 h-6 flex items-center justify-center transition-all duration-200 ${
                          isSelected ? 'scale-110' : 'scale-100 group-hover:scale-105'
                        }`}>
                          <img
                            src={item.icon}
                            alt={item.label}
                            className={`w-full h-full object-contain ${needsInvertInDark(item.id) ? 'dark:invert' : ''}`}
                          />
                        </div>

                        {/* 技能数量 */}
                        <span className={`text-[10px] font-medium transition-colors ${
                          isSelected
                            ? 'text-slate-700 dark:text-white'
                            : 'text-slate-400 dark:text-gray-500'
                        }`}>
                          {getSkillCount(item.id)}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            );
          })}

          {/* 设置按钮 */}
          <div className="relative z-10 w-full mt-1">
            <button
              onClick={handleSettingsClick}
              className="group w-full flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-all duration-200 h-[60px]"
              title={t('settings.tabAgents')}
            >
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className="w-7 h-6 flex items-center justify-center transition-all duration-200 scale-100 group-hover:scale-105">
                  <Icon name="settings" className="w-full h-full text-slate-400 dark:text-gray-500 group-hover:text-slate-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
              </div>
            </button>
          </div>
        </div>
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
