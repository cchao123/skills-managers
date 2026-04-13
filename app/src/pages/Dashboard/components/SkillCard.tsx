import type { SkillMetadata, AgentConfig } from '@/types';
import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';

interface SkillCardProps {
  skill: SkillMetadata;
  agents: AgentConfig[];
  expanded: boolean;
  onToggleExpand: (skillId: string) => void;
  onToggleSkill: (skill: SkillMetadata) => void;
  onToggleAgent: (skill: SkillMetadata, agentName: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
  onShowDetail: (skill: SkillMetadata) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  agents,
  expanded,
  onToggleExpand,
  onToggleSkill,
  onToggleAgent,
  onShowDetail,
}) => {
  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Top section: Icon + Info on left, STATUS + Toggle + Expand on right */}
      <div className="p-4 pb-0">
        <div className="flex justify-between items-start gap-3">
          {/* Left: Icon + Name + Version + Description */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center flex-shrink-0`}>
              <span className="material-symbols-outlined text-xl" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                {getSkillIcon(skill.id)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold truncate text-slate-900 dark:text-white">{skill.name}</h4>
                {/* <span className="text-[10px] font-bold py-0.5 px-1.5 bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-300 rounded uppercase flex-shrink-0">
                  v{skill.version || '1.0'}
                </span> */}
              </div>
              <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 leading-relaxed">{skill.description}</p>
            </div>
          </div>

          {/* Right: STATUS + Toggle + Expand */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onToggleSkill(skill)}
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
      <div className="border-t border-[#f0f0f0] dark:border-dark-border px-4 py-2.5 flex items-center justify-between" onClick={() => onToggleExpand(skill.id)} >
        <div className="flex items-center gap-1.5">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className={`w-5 h-5 rounded-full overflow-hidden flex items-center justify-center ${
                skill.agent_enabled[agent.name]
                  ? ''
                  : 'opacity-40'
              }`}
            >
              <img src={getAgentIcon(agent.name)} alt={agent.display_name} className={`w-full h-full object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`} />
            </div>
          ))}
          <span className="text-[11px] text-slate-500 dark:text-black0 ml-1">
            {agents.filter(a => skill.agent_enabled[a.name]).length}/{agents.length} Agent 已启用
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
          {agents.map((agent, index) => {
            const isLast = index === agents.length - 1;
            return (
              <div key={agent.name} className="relative flex items-center justify-between py-2">
                {/* Vertical line: full height for non-last, half for last (├ / └) */}
                <div
                  className="absolute w-px bg-slate-300 dark:bg-dark-border"
                  style={{ left: '12px', top: 0, height: isLast ? '50%' : '100%' }}
                />
                {/* Horizontal branch (──) */}
                <div
                  className="absolute h-px bg-slate-300 dark:bg-dark-border"
                  style={{ left: '12px', top: '50%', width: '20px', transform: 'translateY(-0.5px)' }}
                />

                {/* Content with indent for tree */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-9">
                  <div className="relative flex-shrink-0 z-10">
                    <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                      <img src={getAgentIcon(agent.name)} alt={agent.display_name} className={`w-full h-full object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-200">{agent.display_name}</span>
                      {!agent.detected && (
                        <span className="text-[10px] text-slate-400 dark:text-gray-500">(未安装)</span>
                      )}
                    </div>
                    <span className={`text-[10px] leading-tight ${
                      skill.agent_enabled[agent.name] ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-gray-500'
                    }`}>
                      {skill.agent_enabled[agent.name] ? '已启用' : '未启用'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => onToggleAgent(skill, agent.name, e)}
                  disabled={!agent.detected}
                  className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
                    skill.agent_enabled[agent.name] ? 'bg-[#b71422]' : 'bg-gray-300 dark:bg-gray-600'
                  } ${!agent.detected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    skill.agent_enabled[agent.name] ? 'translate-x-[14px]' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
