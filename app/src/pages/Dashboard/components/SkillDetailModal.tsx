import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SkillMetadata, AgentConfig, SkillFileEntry } from '@/types';
import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { badgeClass, sourceLabel, SOURCE } from '@/pages/Dashboard/utils/source';
import { getAgentDisplayName } from '@/constants';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';
import { useMergedView } from '@/pages/Dashboard/hooks/useMergedView';
import CardFileTree from '@/components/CardFileTree';
import { FILE_TREE_HEIGHT } from '@/pages/Dashboard/constants/panel';
import { agentsApi } from '@/api/tauri';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';

import { Icon } from '@/components/Icon';
interface SkillDetailModalProps {
  skill: SkillMetadata;
  agents: AgentConfig[];
  skillFiles: SkillFileEntry[];
  loadingFiles: boolean;
  expandedFolders: Set<string>;
  currentFile: { path: string; content: string } | null;
  loadingFile: boolean;
  leftPanelWidth: number;
  isResizing: boolean;
  onClose: () => void;
  onToggleFolder: (path: string) => void;
  onReadFile: (path: string) => void;
  onToggleAgent: (skill: SkillMetadata, agentName: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

function normalizePath(p: string, isWindows: boolean): string {
  return isWindows ? p.replace(/\//g, '\\') : p;
}

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skill,
  agents,
  skillFiles,
  loadingFiles,
  expandedFolders,
  currentFile,
  loadingFile,
  leftPanelWidth,
  isResizing,
  onClose,
  onToggleFolder,
  onReadFile,
  onToggleAgent,
  onDelete,
  onResizeStart,
}) => {
  const { t } = useTranslation();
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win');
  const { allSources, nativeAgents, allPaths } = useMergedView(skill);
  const detectedAgents = useVisibleAgents(agents);

  // Esc 关闭弹窗：组件挂载即代表弹窗打开，卸载时自动清理
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleAgentToggle = (agentName: string, e?: React.MouseEvent<HTMLButtonElement>) =>
    onToggleAgent(skill, agentName, e);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // 仅当点击的是遮罩自身（不是其内部内容）时关闭
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-xl w-[65%] max-w-[1400px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-3 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center`}>
                <Icon name={getSkillIcon(skill.id)} className="text-2xl" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-xl font-bold text-black dark:text-white">{skill.name}</h2>
                  {allSources.map(src => (
                    <span key={src} className={`text-[10px] font-bold py-0.5 px-1.5 rounded flex-shrink-0 ${badgeClass(src)}`}>
                      {sourceLabel(src)}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(() => {
                    const sourceToFullName = (s: string) =>
                      s === SOURCE.Global
                        ? t('dashboard.source.global')
                        : getAgentDisplayName(s);
                    const isSingle = allSources.length === 1;
                    const onlySource = allSources[0];
                    const showAgentIcon = isSingle && onlySource && onlySource !== SOURCE.Global && getAgentIcon(onlySource);
                    return (
                      <>
                        {showAgentIcon ? (
                          <img
                            src={getAgentIcon(onlySource)}
                            alt={onlySource}
                            className={`w-3.5 h-3.5 object-contain ${needsInvertInDark(onlySource) ? 'dark:invert' : ''}`}
                          />
                        ) : (
                          <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-3.5 h-3.5" />
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {isSingle
                            ? `From ${sourceToFullName(onlySource ?? SOURCE.Global)}`
                            : `From ${allSources.map(sourceToFullName).join(' + ')}`}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
            >
              <Icon name="close" className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{skill.description}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-20 py-3">
          <div className="space-y-4">
            {/* File Tree with Content Preview - Split View */}
            {skillFiles.length > 0 ? (
              <div>
                <div className="mb-2 space-y-1">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">{t('dashboard.detail.fileDirectory')}</h3>
                  {allPaths.map(({ source, path }) => {
                    const display = normalizePath(path, isWindows);
                    return (
                      <div key={`${source}:${path}`} className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold py-0.5 px-1 rounded ${badgeClass(source)}`}>
                          {sourceLabel(source)}
                        </span>
                        <p
                          className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate flex-1 min-w-0 cursor-pointer hover:underline"
                          title={display}
                          onClick={() => agentsApi.openFolderPath(display)}
                        >
                          {display}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-[#fafafa] dark:bg-dark-bg-secondary rounded-lg flex overflow-hidden relative" style={{ height: FILE_TREE_HEIGHT }}>
                  {/* Left: File Tree */}
                  <div className="overflow-y-auto show-scrollbar p-2" style={{ width: `${leftPanelWidth}%` }}>
                    {loadingFiles ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-gray-200 dark:border-dark-bg-secondary border-t-[#b71422]"></div>
                      </div>
                    ) : (
                      <CardFileTree
                        files={skillFiles}
                        expandedFolders={expandedFolders}
                        onToggleFolder={onToggleFolder}
                        onReadFile={onReadFile}
                        currentFile={currentFile?.path}
                      />
                    )}
                  </div>

                  {/* Resizable Divider */}
                  <div
                    className={`resizable-divider w-1.5 bg-gray-200 dark:bg-dark-border hover:bg-[#b71422] dark:hover:bg-[#b71422] cursor-col-resize relative z-10 flex items-center justify-center group ${
                      isResizing ? 'bg-[#b71422]' : ''
                    }`}
                    onMouseDown={onResizeStart}
                    title={t('dashboard.detail.dragResize')}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="w-0.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full group-hover:bg-white transition-colors"></div>
                      <div className="w-0.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full group-hover:bg-white transition-colors"></div>
                    </div>
                  </div>

                  {/* Right: File Content Preview */}
                  <div className="overflow-y-auto bg-white dark:bg-dark-bg-card flex-1 show-scrollbar">
                    {currentFile ? (
                      <div className="h-full p-3">
                        {loadingFile ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="inline-block animate-spin rounded-full h-5 w-5 border-4 border-gray-200 dark:border-dark-bg-secondary border-t-[#b71422]"></div>
                          </div>
                        ) : (
                          <pre className="text-xs text-slate-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                            {currentFile.content}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 dark:text-gray-500">
                        <div className="text-center">
                          <Icon name="description" className="text-3xl mb-2" />
                          <p className="text-xs">{t('dashboard.detail.clickToView')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 space-y-1">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">{t('dashboard.detail.fileDirectory')}</h3>
                  {allPaths.map(({ source, path }) => {
                    const display = normalizePath(path, isWindows);
                    return (
                      <div key={`${source}:${path}`} className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold py-0.5 px-1 rounded ${badgeClass(source)}`}>
                          {sourceLabel(source)}
                        </span>
                        <p
                          className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate flex-1 min-w-0 cursor-pointer hover:underline"
                          title={display}
                          onClick={() => agentsApi.openFolderPath(display)}
                        >
                          {display}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-[#fafafa] dark:bg-dark-bg-secondary rounded-lg p-6" style={{ height: FILE_TREE_HEIGHT }}>
                  {loadingFiles ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-dark-bg-secondary border-t-[#b71422] mb-3"></div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.detail.loadingFiles')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Icon name="folder_open" className="text-4xl text-gray-400 dark:text-gray-500 mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.detail.noFiles')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('dashboard.detail.noFilesHint')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agent Status */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.detail.agentStatus')}</h3>
              <div className="bg-[#fafafa] dark:bg-dark-bg-secondary rounded-lg px-3 py-3 relative pb-1">
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
                                <Icon name="home" style={{ fontSize: '11px' }} />
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary relative">
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-12 h-12 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors absolute left-1/2 -translate-x-1/2 bottom-4 shadow-lg"
              title={t('dashboard.detail.deleteSkill')}
            >
              <Icon name="delete" className="text-lg" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
