import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { agentsApi } from '@/api/tauri';
import octopusIcon from '@/assets/agents/octopus.svg';
import type { AgentConfig } from '@/types';
import { getAgentScanPaths } from '@/pages/Settings/constants/agentScanPaths';
import { KNOWN_AGENTS } from '@/constants';

interface AgentsSectionProps {
  agents: AgentConfig[];
}

export const AgentsSection: React.FC<AgentsSectionProps> = ({ agents }) => {
  const { t } = useTranslation();
  const detectedSet = new Set(agents.filter(a => a.detected).map(a => a.name));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleOpenPath = (path: string) => {
    agentsApi.openFolderPath(path).catch(() => {});
  };

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Agents card */}
      <div className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">
              smart_toy
            </span>
            {t('settings.agents.title')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {t('settings.agents.subtitle')}
          </p>
        </div>

        <div className="divide-y divide-[#e1e3e4] dark:divide-dark-border">
          {KNOWN_AGENTS.map((agent) => {
            const detected = detectedSet.has(agent.name);
            const scanPaths = getAgentScanPaths(agent.name);
            const hasScanPaths = scanPaths.length > 0;
            const isExpanded = expanded.has(agent.name);
            const canExpand = detected && hasScanPaths;

            return (
              <div key={agent.name}>
                <div className="w-full flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors">
                  <button
                    type="button"
                    onClick={() =>
                      canExpand ? toggleExpand(agent.name) : handleOpenPath(agent.rootPath)
                    }
                    disabled={!detected}
                    aria-expanded={canExpand ? isExpanded : undefined}
                    className="flex-1 min-w-0 pl-6 pr-2 py-4 flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={getAgentIcon(agent.name)}
                        alt={agent.displayName}
                        className={`w-6 h-6 object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {agent.displayName}
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
                        {agent.rootPath}
                      </p>
                    </div>
                  </button>

                  {canExpand && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(agent.name)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? t('settings.agents.collapse') : t('settings.agents.expand')}
                      title={isExpanded ? t('settings.agents.collapse') : t('settings.agents.expand')}
                      className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 dark:text-gray-500 hover:bg-white dark:hover:bg-dark-bg-card hover:text-[#b71422] transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  )}

                  {detected && (
                    <button
                      type="button"
                      onClick={() => handleOpenPath(agent.rootPath)}
                      aria-label={agent.rootPath}
                      title={agent.rootPath}
                      className="shrink-0 w-8 h-8 mr-4 rounded-md flex items-center justify-center text-slate-300 dark:text-gray-600 hover:bg-white dark:hover:bg-dark-bg-card hover:text-[#b71422] transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">open_in_new</span>
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="px-6 pb-4 pt-1 bg-slate-50/50 dark:bg-dark-bg-tertiary/40">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 mb-2 pl-[52px] uppercase tracking-wide">
                      {t('settings.agents.scanPaths')}
                    </p>
                    <ul className="space-y-1 pl-[52px]">
                      {scanPaths.map((p) => (
                        <li key={p}>
                          <button
                            type="button"
                            onClick={() => handleOpenPath(p)}
                            title={p}
                            className="group w-full flex items-center gap-2 py-1 px-2 -ml-2 rounded-md hover:bg-white dark:hover:bg-dark-bg-card transition-colors text-left"
                          >
                            <span className="material-symbols-outlined text-sm text-slate-400 dark:text-gray-500 shrink-0">
                              subdirectory_arrow_right
                            </span>
                            <span className="flex-1 min-w-0 text-xs font-mono text-slate-600 dark:text-gray-300 truncate group-hover:text-[#b71422]">
                              {p}
                            </span>
                            <span className="material-symbols-outlined text-sm text-slate-300 dark:text-gray-600 group-hover:text-[#b71422] shrink-0">
                              open_in_new
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills Manager card */}
      <button
        type="button"
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
