import { useTranslation } from 'react-i18next';
import type { SkillMetadata, AgentConfig, MergedSkillInfo } from '@/types';
// TODO: 暂时隐藏技能图标，缺少每个技能对应的 icon 映射，恢复时一并启用
// import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { badgeClass, sourceLabel } from '@/pages/Dashboard/utils/source';
import { useDetectedAgents } from '@/pages/Dashboard/hooks/useDetectedAgents';
import { useMergedView } from '@/pages/Dashboard/hooks/useMergedView';

interface SkillCardProps {
  skill: SkillMetadata;
  agents: AgentConfig[];
  expanded: boolean;
  merged?: MergedSkillInfo;
  onToggleExpand: () => void;
  onToggleSkill: (skill: SkillMetadata) => void;
  onToggleAgent: (skill: SkillMetadata, agentName: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
  onShowDetail: (skill: SkillMetadata) => void;
  onToggleSkillMerged?: (merged: MergedSkillInfo) => void;
  onToggleAgentMerged?: (merged: MergedSkillInfo, agentName: string) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  agents,
  expanded,
  merged,
  onToggleExpand,
  onToggleSkill,
  onToggleAgent,
  onShowDetail,
  onToggleSkillMerged,
  onToggleAgentMerged,
}) => {
  const { t } = useTranslation();
  const { allSources, nativeAgents } = useMergedView(skill, merged);
  const detectedAgents = useDetectedAgents(agents);
  const enabledCount = detectedAgents.filter(a => skill.agent_enabled[a.name]).length;

  const handleMainToggle = () => {
    if (merged && onToggleSkillMerged) {
      onToggleSkillMerged(merged);
    } else {
      onToggleSkill(skill);
    }
  };

  const handleAgentToggle = (agentName: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (merged && onToggleAgentMerged) {
      onToggleAgentMerged(merged, agentName);
    } else {
      onToggleAgent(skill, agentName, e);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Top section: Icon + Info on left, STATUS + Toggle + Expand on right */}
      <div className="p-4 pb-0">
        <div className="flex justify-between items-start gap-3">
          {/* Left: Icon + Name + Source Badges + Description */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* 暂时隐藏技能图标：缺少每个技能对应的 icon 映射，先注释避免展示错位/兜底图
            <div className={`w-10 h-10 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center flex-shrink-0`}>
              <span className="material-symbols-outlined text-xl" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                {getSkillIcon(skill.id)}
              </span>
            </div>
            */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-base font-bold truncate text-slate-900 dark:text-white">{skill.name}</h4>
                {allSources.map(src => (
                  <span key={src} className={`text-[10px] font-bold py-0.5 px-1.5 rounded flex-shrink-0 ${badgeClass(src)}`}>
                    {sourceLabel(src)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 leading-relaxed">{skill.description}</p>
            </div>
          </div>

          {/* Right: STATUS + Toggle + Expand */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleMainToggle}
                className={`relative w-9 h-5 rounded-full transition-all flex-shrink-0 ${skill.enabled ? 'bg-[#b71422]' : 'bg-[#CBD5E0] dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onShowDetail(skill)} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors">
                <span className="material-symbols-outlined text-base text-slate-400 dark:text-gray-500">info</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: agent summary + expand button (always visible) */}
      <div className="border-t border-[#f0f0f0] dark:border-dark-border px-4 py-2.5 flex items-center justify-between" onClick={onToggleExpand} >
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
        </div>
        <button className="p-1 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-base text-slate-500 dark:text-gray-400">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {/* Expandable: Agent toggles (accordion style) */}
      {expanded && (
        <div className="border-t border-[#f0f0f0] dark:border-dark-border bg-[#fafafa] dark:bg-dark-bg-secondary px-3 py-3 relative pb-1">
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
                          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>terminal</span>
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
                          <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
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
