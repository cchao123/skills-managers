import { useTranslation } from 'react-i18next';
import type { SkillMetadata, AgentConfig } from '@/types';
// TODO: 暂时隐藏技能图标，缺少每个技能对应的 icon 映射，恢复时一并启用
// import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { useMergedView } from '@/pages/Dashboard/hooks/useMergedView';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';
import { MainToggleIndicator, type MainToggleState } from '@/pages/Dashboard/components/MainToggleIndicator';
import { NativeSourceWatermark } from '@/pages/Dashboard/components/NativeSourceWatermark';
import { PinIndicator } from '@/pages/Dashboard/components/PinIndicator';
import { SOURCE } from '@/pages/Dashboard/utils/source';

import { Icon } from '@/components/Icon';
interface SkillCardProps {
  skill: SkillMetadata;
  agents: AgentConfig[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleSkill: (skill: SkillMetadata) => void;
  onToggleAgent: (skill: SkillMetadata, agentName: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
  onShowDetail: (skill: SkillMetadata) => void;
  /** 右键点击时触发，由父组件统一管理上下文菜单 */
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** 当前卡片是否已被置顶（影响排序 + 显示 pin 标记） */
  pinned?: boolean;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  agents,
  expanded,
  onToggleExpand,
  onToggleSkill,
  onToggleAgent,
  onShowDetail,
  onContextMenu,
  pinned = false,
}) => {
  const { t } = useTranslation();
  const { allSources, nativeAgents } = useMergedView(skill);
  const detectedAgents = useVisibleAgents(agents);
  const enabledCount = detectedAgents.filter(a => skill.agent_enabled[a.name]).length;
  const detectedNativeAgents = detectedAgents
    .map(a => a.name)
    .filter(name => nativeAgents.has(name));
  const togglableAgents = detectedAgents.filter(a => !nativeAgents.has(a.name));
  const togglableEnabledCount = togglableAgents.filter(a => skill.agent_enabled[a.name]).length;

  // 样式映射与图例共享在 MainToggleIndicator 内，这里只负责状态推导
  const mainToggleState: MainToggleState =
    togglableEnabledCount > 0
      ? 'on'
      : enabledCount > 0
        ? 'nativeOnly'
        : 'off';

  const mainToggleTitle =
    mainToggleState === 'off'
      ? t('dashboard.mainToggle.allOff')
      : mainToggleState === 'nativeOnly'
        ? t('dashboard.mainToggle.nativeOnly', { agents: detectedNativeAgents.join('、') })
        : t('dashboard.mainToggle.allOn');

  const handleMainToggle = () => onToggleSkill(skill);
  const handleAgentToggle = (agentName: string, e?: React.MouseEvent<HTMLButtonElement>) =>
    onToggleAgent(skill, agentName, e);

  return (
    <div
      className={`relative bg-white dark:bg-dark-bg-card rounded-xl border ${
        pinned
          ? 'border-[#b71422]/40 dark:border-[#b71422]/50 shadow-[0_0_0_1px_rgba(183,20,34,0.08)]'
          : 'border-[#e1e3e4] dark:border-dark-border'
      } hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 overflow-hidden flex flex-col`}
      onContextMenu={onContextMenu}
    >
      <PinIndicator pinned={pinned} />

      {/* 主信息区（top section + bottom bar）共享一个 relative 容器，
          水印钉在这个区域的右下角 —— 即使 accordion 展开了，水印仍然停留在原来的位置。 */}
      <div className="relative">
      <NativeSourceWatermark nativeAgents={detectedNativeAgents} inRoot={allSources.includes(SOURCE.Global)} />

      {/* Top section: Icon + Info on left, STATUS + Toggle + Expand on right */}
      <div className="relative z-10 p-4 pb-0">
        <div className="flex justify-between items-start gap-3">
          {/* Left: Icon + Name + Source Badges + Description */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* 暂时隐藏技能图标：缺少每个技能对应的 icon 映射，先注释避免展示错位/兜底图
            <div className={`w-10 h-10 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center flex-shrink-0`}>
              <Icon name={getSkillIcon(skill.id)} className="text-xl" />
            </div>
            */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-base font-bold truncate text-slate-900 dark:text-white">{skill.name}</h4>
              </div>
              <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 leading-relaxed">{skill.description}</p>
            </div>
          </div>

          {/* Right: STATUS + Toggle + Expand */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <MainToggleIndicator
                state={mainToggleState}
                onClick={handleMainToggle}
                title={mainToggleTitle}
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onShowDetail(skill)} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors">
                <Icon name="info" className="text-base text-slate-400 dark:text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: agent summary + expand button (always visible) */}
      <div className="relative z-10 px-4 py-2.5 flex items-center cursor-pointer" onClick={onToggleExpand} >
        {/* 短分割线：避开右下角的来源水印（水印 size=110，露出约 90px，留 ~20px 缓冲） */}
        <span
          className="absolute left-4 right-[110px] top-0 h-px bg-[#f0f0f0] dark:bg-dark-border pointer-events-none"
          aria-hidden="true"
        />
        <div className="flex items-center gap-1.5">
          {detectedAgents.map((agent) => (
            <div
              key={agent.name}
              className={`w-5 h-5 rounded-full overflow-hidden flex items-center justify-center ${
                skill.agent_enabled[agent.name] ? '' : 'opacity-40'
              }`}
            >
              <img src={getAgentIcon(agent.name)} alt={agent.display_name} className={`w-full h-full object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`} />
            </div>
          ))}
          <span className="text-[11px] text-slate-500 dark:text-black0 ml-1">
            {enabledCount}/{detectedAgents.length} {t('dashboard.agentsEnabled')}
          </span>
          <Icon name={expanded ? 'expand_less' : 'expand_more'} className="text-base text-slate-400 dark:text-gray-500 ml-0.5" />
        </div>
      </div>
      </div>

      {/* Expandable: Agent toggles (accordion style)
          顶部 inset 阴影：让水印在衔接处自然"被压在下面"，避免硬切感。 */}
      {expanded && (
        <div className="relative z-10 bg-[#fafafa] dark:bg-dark-bg-secondary px-3 py-3 pb-1 shadow-[inset_0_6px_8px_-6px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_6px_8px_-6px_rgba(0,0,0,0.5)]">
          {detectedAgents.map((agent, index) => {
            const isLast = index === detectedAgents.length - 1;
            const isNativeAgent = nativeAgents.has(agent.name);
            return (
              <div key={agent.name} className="relative flex items-center justify-between py-2">
                <div
                  className="absolute w-px bg-slate-300 dark:bg-dark-border"
                  style={{ left: '12px', top: 0, height: isLast ? '50%' : '100%' }}
                />
                <div
                  className="absolute h-px bg-slate-300 dark:bg-dark-border"
                  style={{ left: '12px', top: '50%', width: '20px', transform: 'translateY(-0.5px)' }}
                />

                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-9">
                  <div className="relative flex-shrink-0 z-10">
                    <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                      <img src={getAgentIcon(agent.name)} alt={agent.display_name} className={`w-full h-full object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-200">{agent.display_name}</span>
                      {isNativeAgent && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <Icon name="terminal" style={{ fontSize: '11px' }} />
                          {t('dashboard.nativeSource')}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] leading-tight ${
                      isNativeAgent
                        ? 'font-bold text-amber-600 dark:text-amber-400'
                        : skill.agent_enabled[agent.name] ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-gray-500'
                    }`}>
                      {isNativeAgent
                        ? t('dashboard.alwaysEnabled')
                        : skill.agent_enabled[agent.name] ? t('dashboard.agentEnabled') : t('dashboard.agentDisabled')}
                    </span>
                  </div>
                </div>
                {isNativeAgent ? (
                  <div className="relative group/tip flex-shrink-0">
                    <div className="w-8 h-[18px] rounded-full bg-amber-500 dark:bg-amber-500 cursor-not-allowed">
                      <span className="absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full shadow-sm translate-x-[14px]" />
                    </div>
                    <div className="hidden group-hover/tip:flex absolute bottom-full right-0 mb-2 w-56 pointer-events-none z-50">
                      <div className="bg-white dark:bg-dark-bg-card border border-amber-200 dark:border-amber-500/30 rounded-lg shadow-lg p-2.5 flex gap-2 items-start">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                          <Icon name="warning" className="text-sm text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-gray-300">{t('dashboard.nativeSourceTip')}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleAgentToggle(agent.name, e)}
                    className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                      skill.agent_enabled[agent.name] ? 'bg-[#b71422]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      skill.agent_enabled[agent.name] ? 'translate-x-[14px]' : 'translate-x-0'
                    }`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
