import { useTranslation } from 'react-i18next';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { agentsApi } from '@/api/tauri';
import octopusIcon from '@/assets/agents/octopus.svg';
import type { AgentConfig } from '@/types';

interface AgentsSectionProps {
  agents: AgentConfig[];
}

/** 前端维护的完整 agent 列表（不依赖后端配置） */
const KNOWN_AGENTS: { name: string; display_name: string; path: string }[] = [
  { name: 'claude', display_name: 'Claude Code', path: '~/.claude' },
  { name: 'cursor', display_name: 'Cursor', path: '~/.cursor' },
  { name: 'codex', display_name: 'Codex', path: '~/.codex' },
  { name: 'openclaw', display_name: 'OpenClaw', path: '~/.openclaw' },
  { name: 'opencode', display_name: 'OpenCode', path: '~/.opencode' },
];

export const AgentsSection: React.FC<AgentsSectionProps> = ({ agents }) => {
  const { t } = useTranslation();
  // 用后端检测结果标记 detected 状态
  const detectedSet = new Set(agents.filter(a => a.detected).map(a => a.name));

  const handleOpenPath = (path: string) => {
    agentsApi.openFolderPath(path).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Agents card */}
      <div className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.agents.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {t('settings.agents.subtitle')}
          </p>
        </div>

        <div className="divide-y divide-[#e1e3e4] dark:divide-dark-border">
          {KNOWN_AGENTS.map((agent) => {
            const detected = detectedSet.has(agent.name);
            return (
              <button
                key={agent.name}
                onClick={() => handleOpenPath(agent.path)}
                disabled={!detected}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={getAgentIcon(agent.name)}
                    alt={agent.display_name}
                    className={`w-6 h-6 object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {agent.display_name}
                    </span>
                    {detected ? (
                      <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold rounded-full">
                        {t('settings.agents.installed')}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-500 dark:text-gray-500 text-[10px] font-semibold rounded-full">
                        {t('settings.agents.notInstalled')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 font-mono truncate">
                    {agent.path}
                  </p>
                </div>
                {detected && (
                  <span className="material-symbols-outlined text-lg text-slate-300 dark:text-gray-600 shrink-0">
                    open_in_new
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills Manager card */}
      <button
        onClick={() => agentsApi.openFolder().catch(() => {})}
        className="w-full bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center shrink-0 overflow-hidden">
          <img
            src={octopusIcon}
            alt="Skills Manager"
            className="w-6 h-6 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings.agents.skillsManager')}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 font-mono truncate">
            ~/.skills-manager
          </p>
        </div>
        <span className="material-symbols-outlined text-lg text-slate-300 dark:text-gray-600 shrink-0">
          open_in_new
        </span>
      </button>
    </div>
  );
};
