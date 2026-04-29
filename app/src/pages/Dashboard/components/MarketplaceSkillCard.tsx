import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Skill, AgentConfig } from '@/types';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { NativeSourceWatermark } from '@/pages/Dashboard/components/NativeSourceWatermark';
import { PinIndicator } from '@/pages/Dashboard/components/PinIndicator';

import { Icon } from '@/components/Icon';
interface MarketplaceSkillCardProps {
  skill: Skill;
  onInfo: (skillId: string) => void;
  onDelete?: (skillId: string) => void;
  onAddToRoot?: (skillId: string) => void;
  isInRoot?: boolean;
  /** 用于在浮层中展示每个 Agent 的开启情况；缺省则不渲染下拉按钮 */
  agents?: AgentConfig[];
  agentEnabled?: Record<string, boolean>;
  /** 原生目录所在的 Agent 集合（始终启用，无法关闭） */
  nativeAgents?: Set<string>;
  /** 浮层内点击 toggle 时切换某个 agent 的启用状态；缺省则 toggle 只读 */
  onToggleAgent?: (agentName: string) => void;
  /** 右键点击时触发，由父组件统一管理上下文菜单 */
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
  /** 当前卡片是否已被置顶（影响排序 + 显示 pin 标记） */
  pinned?: boolean;
}

function MarketplaceSkillCard({
  skill,
  onInfo,
  onDelete,
  onAddToRoot,
  isInRoot,
  agents,
  agentEnabled,
  nativeAgents,
  onToggleAgent,
  onContextMenu,
  pinned = false,
}: MarketplaceSkillCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const detectedAgents = useVisibleAgents(agents ?? []);
  const canExpand = detectedAgents.length > 0 && !!agentEnabled;

  // 仅显示已检测到的原生 agent（避免水印里出现没安装的 CLI）
  const detectedNativeAgents = detectedAgents
    .map(a => a.name)
    .filter(name => nativeAgents?.has(name));

  return (
    <article
      className={`relative bg-white dark:bg-dark-bg-card rounded-xl border ${
        pinned
          ? 'border-[#b71422]/40 dark:border-[#b71422]/50 shadow-[0_0_0_1px_rgba(183,20,34,0.08)]'
          : 'border-[#e1e3e4] dark:border-dark-border'
      } hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 flex flex-col group overflow-hidden`}
      onMouseLeave={() => setExpanded(false)}
      onContextMenu={onContextMenu}
    >
      <NativeSourceWatermark nativeAgents={detectedNativeAgents} inRoot={!!isInRoot} />
      <PinIndicator pinned={pinned} />

      <div className="relative z-10 p-4">

        {/* Icon + Version badge */}
        <div className="flex justify-between items-start mb-3">
          <div className={`w-12 h-12 rounded-lg ${skill.iconColor} flex items-center justify-center`}>
            <Icon name={skill.icon} className="text-2xl" />
          </div>
          <span className="text-[10px] font-bold py-0.5 px-1.5 bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-300 rounded uppercase">
            {skill.version}
          </span>
        </div>
        <h4 className="text-base font-bold mb-1 truncate text-slate-900 dark:text-white">{skill.name}</h4>
        <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 min-h-[2.5rem] leading-relaxed">
          {skill.description}
        </p>

        <div
          className={`flex items-center justify-between gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400 rounded ${
            canExpand ? 'cursor-pointer' : ''
          }`}
          onMouseEnter={() => canExpand && setExpanded(true)}
        >
          <div className="flex items-center gap-1 min-w-0">
            {skill.enabledAgentCount > 0 ? (
              <Icon name="check_circle" className="text-xs text-green-500" />
            ) : (
              <Icon name="radio_button_unchecked" className="text-xs text-gray-400 dark:text-gray-500" />
            )}
            <span className="text-[#191c1d] dark:text-white truncate">{skill.enabledAgentCount}/{skill.totalAgentCount} {t('dashboard.source.agentEnabled')}</span>
          </div>
          {canExpand && (
            <span
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
              aria-hidden="true"
            >
              <Icon name="expand_more" className="text-base text-slate-500 dark:text-gray-400" />
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {/* 情况1：根目录tab → 显示删除按钮 */}
          {onDelete && (
            <button
              onClick={() => onDelete(skill.id)}
              className="flex-1 bg-[#b71422] hover:bg-red-700 text-white py-2 rounded-lg font-bold text-xs transition-colors"
            >
              {t('dashboard.source.removeFromRoot')}
            </button>
          )}

          {/* 情况2：其他tab (Cursor/Agent) → 显示拷贝或已存在状态 */}
          {!onDelete && onAddToRoot && (
            <>
              {isInRoot ? (
                <div className="flex-1 py-2 rounded-lg font-bold text-xs text-center bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-400 border border-[#e1e3e4] dark:border-dark-border cursor-not-allowed">
                  {t('dashboard.source.existsInRoot')}
                </div>
              ) : (
                <button
                  onClick={() => onAddToRoot(skill.id)}
                  className="flex-1 bg-[#b71422] text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  {t('dashboard.source.copyToRoot')}
                </button>
              )}
            </>
          )}

          {/* 信息按钮：始终显示 */}
          <button
            onClick={() => onInfo(skill.id)}
            className="w-9 h-9 border border-[#e1e3e4] dark:border-dark-border bg-[#f3f4f5] dark:bg-dark-bg-tertiary text-slate-600 dark:text-gray-300 rounded-lg flex items-center justify-center hover:bg-[#edeeef] dark:hover:bg-dark-hover transition-colors"
          >
            <Icon name="info" className="text-base" />
          </button>
        </div>
      </div>

      {/* 浮层：覆盖整个卡片 div，hover 时淡入显示 */}
      {canExpand && (
        <div
          className={`absolute inset-0 z-20 bg-white dark:bg-dark-bg-card rounded-xl flex flex-col overflow-hidden transition-opacity duration-150 ease-out ${
            expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          role="dialog"
          aria-label="Agent status"
          aria-hidden={!expanded}
          onMouseLeave={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[#f0f0f0] dark:border-dark-border text-[12px] font-semibold hover:bg-slate-50 dark:hover:bg-dark-bg-secondary transition-colors"
          >
            <span className="text-[#191c1d] dark:text-white truncate">
              {skill.enabledAgentCount}/{skill.totalAgentCount} {t('dashboard.source.agentEnabled')}
            </span>
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              <Icon name="expand_less" className="text-base text-slate-500 dark:text-gray-400" />
            </span>
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 bg-white dark:bg-dark-bg-card divide-y divide-[#f0f0f0] dark:divide-dark-border">
            {detectedAgents.map((agent) => {
              const isNative = nativeAgents?.has(agent.name) ?? false;
              const isOn = isNative || !!agentEnabled?.[agent.name];
              const statusText = isNative
                ? t('dashboard.alwaysEnabled')
                : isOn ? t('dashboard.agentEnabled') : t('dashboard.agentDisabled');
              return (
                <div
                  key={agent.name}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-[#f7f8f9] dark:hover:bg-dark-bg-secondary transition-colors"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#f3f4f5] dark:bg-dark-bg-tertiary">
                    <img
                      src={getAgentIcon(agent.name)}
                      alt={agent.display_name}
                      className={`w-full h-full object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-gray-100 truncate">{agent.display_name}</span>
                    {isNative && (
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 px-1.5 py-[1px] rounded-full whitespace-nowrap">
                        {t('dashboard.nativeSource')}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    isNative
                      ? 'text-amber-600 dark:text-amber-400'
                      : isOn ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-gray-500'
                  }`}>
                    {statusText}
                  </span>
                  {isNative || !onToggleAgent ? (
                    <div
                      className={`relative w-8 h-[18px] rounded-full flex-shrink-0 ${
                        isNative ? 'bg-amber-500 cursor-not-allowed' : isOn ? 'bg-[#b71422]' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      title={statusText}
                    >
                      <span className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full shadow-sm ${
                        isNative || isOn ? 'translate-x-[14px]' : 'translate-x-0'
                      }`} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAgent(agent.name);
                      }}
                      className={`relative w-8 h-[18px] rounded-full flex-shrink-0 cursor-pointer transition-colors ${
                        isOn ? 'bg-[#b71422]' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      title={statusText}
                      aria-label={`Toggle ${agent.display_name}`}
                      aria-pressed={isOn}
                    >
                      <span className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                        isOn ? 'translate-x-[14px]' : 'translate-x-0'
                      }`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export default MarketplaceSkillCard;
