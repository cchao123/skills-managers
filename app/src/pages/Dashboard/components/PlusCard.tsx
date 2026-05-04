import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';

import { Icon } from '@/components/Icon';

interface PlusCardProps {
  agents: AgentConfig[];
  currentAgent: string;
  onOpen: () => void;
}

export const PlusCard: React.FC<PlusCardProps> = ({ agents, currentAgent, onOpen }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  // 获取目标名称
  const getTargetName = () => {
    if (currentAgent === SOURCE.Global) {
      return t('dashboard.source.global');
    }
    const agent = agents.find(a => a.name === currentAgent);
    return agent ? agent.display_name : currentAgent;
  };

  // 获取可用的源 agents（排除当前 agent，只显示已安装的）
  const sourceAgents = agents.filter(a => a.name !== currentAgent && a.detected);

  // 最多显示 9 个
  const displayAgents = sourceAgents.slice(0, 9);
  // 如果超过9个，显示"更多"提示
  const hasMore = sourceAgents.length > 9;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-white dark:bg-dark-bg-card rounded-xl border border-dashed border-2 border-slate-300 dark:border-dark-border hover:border-[#b71422]/60 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-all cursor-pointer flex flex-col items-center justify-center py-4 min-h-[140px] group"
    >
      {/* 垂直布局：两行 */}
      <div className="flex flex-col items-center gap-2 w-full px-4">
        {/* 第一行：可选 Agent（根据数量动态调整布局） */}
        <div className={`flex items-center justify-center transition-all duration-300 ${displayAgents.length <= 5 ? 'gap-1.5 w-full' : 'relative h-10 w-full'}`}>
          {displayAgents.map((agent, index) => {
            const total = displayAgents.length;

            // 5个及以下：正常水平排列
            if (total <= 5) {
              return (
                <div
                  key={agent.name}
                  className="flex-shrink-0"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center border-2 border-slate-200 dark:border-dark-border shadow-sm overflow-hidden hover:border-[#b71422]/40 hover:shadow-md transition-all">
                    <img
                      src={getAgentIcon(agent.name)}
                      alt={agent.display_name}
                      className={`w-full h-full object-contain p-0.5 ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                    />
                  </div>
                </div>
              );
            }

            // 6个及以上：堆叠显示
            const centerOffset = (total - 1) / 2;
            const safeMargin = 16;
            const availableWidth = 100 - (safeMargin * 2 / 320 * 100);
            const offsetPercent = ((index - centerOffset) / Math.max(total - 1, 1)) * availableWidth;
            const offsetPx = (offsetPercent / 100) * 320;

            return (
              <div
                key={agent.name}
                className="absolute transition-all duration-300 hover:z-10"
                style={{
                  transform: `translateX(${offsetPx}px)`,
                  zIndex: index,
                }}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center border-2 border-slate-200 dark:border-dark-border shadow-sm overflow-hidden hover:border-[#b71422]/40 hover:shadow-md transition-all">
                  <img
                    src={getAgentIcon(agent.name)}
                    alt={agent.display_name}
                    className={`w-full h-full object-contain p-0.5 ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                  />
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div className="absolute right-2 text-xs text-slate-400 dark:text-gray-500 font-medium">
              +{sourceAgents.length - 9}
            </div>
          )}
        </div>

        {/* 中间：向下箭头 */}
        <div className={`flex-shrink-0 transition-all duration-300 ${isHovered ? 'translate-y-0.5' : ''}`}>
          <span className={`text-3xl font-light leading-none ${isHovered ? 'text-[#b71422]' : 'text-slate-400 dark:text-gray-500'}`}>↓</span>
        </div>

        {/* 第二行：目标 Agent */}
        <div className="flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-white dark:bg-dark-bg-card flex items-center justify-center shadow-sm overflow-hidden">
            <img
              src={getAgentIcon(currentAgent)}
              alt={getTargetName()}
              className={`w-full h-full object-contain p-1 ${needsInvertInDark(currentAgent) ? 'dark:invert' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* 文字说明 */}
      <div className="text-center px-4 pt-2">
        <p className="text-sm font-medium text-slate-600 dark:text-gray-300 group-hover:text-[#b71422] transition-colors flex items-center justify-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary border-2 border-slate-300 dark:border-dark-border flex items-center justify-center group-hover:border-[#b71422]/60 group-hover:bg-white dark:group-hover:bg-dark-bg-card transition-all shadow-sm hover:shadow-md flex-shrink-0">
            <Icon name="add" className="text-base text-slate-400 dark:text-gray-500 group-hover:text-[#b71422] transition-colors" />
          </span>
          <span>{t('dashboard.import.fromOther')} {getTargetName()}</span>
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
          {t('dashboard.import.selectAgentHint')}
        </p>
      </div>
    </div>
  );
};

