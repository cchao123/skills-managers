import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CodeProps } from 'react-markdown/lib/components';
import type { SkillMetadata, AgentConfig, SkillFileEntry } from '@/types';
import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { badgeClass, sourceLabel, SOURCE } from '@/pages/Dashboard/utils/source';
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
  onDelete: () => void;
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
  // Markdown 视图模式状态
  const [markdownView, setMarkdownView] = useState<'raw' | 'preview'>('raw');

  // 注入抽屉动画样式
  if (typeof document !== 'undefined' && !document.getElementById('drawer-animation')) {
    const style = document.createElement('style');
    style.id = 'drawer-animation';
    style.textContent = `
      @keyframes drawerSlideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .drawer-animate-in {
        animation: drawerSlideIn 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
  }
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
      className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]"
      onClick={(e) => {
        // 仅当点击的是遮罩自身（不是其内部内容）时关闭
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-[600px] max-w-[85vw] bg-white dark:bg-dark-bg-card shadow-2xl flex flex-col drawer-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 p-6 pb-3 border-b border-gray-200 dark:border-dark-border"
          data-tauri-drag-region
        >
          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title={t('dashboard.detail.deleteSkill')}
            >
              <Icon name="delete" className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
            >
              <Icon name="close" className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Title section */}
          <div className="flex items-center gap-3 mb-3 pr-20">
            <div className={`w-12 h-12 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center`}>
              <Icon name={getSkillIcon(skill.id)} className="text-2xl" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-bold text-black dark:text-white">{skill.name}</h2>
                {allSources.map(src => (
                  <span key={src} className={`text-[10px] font-bold py-0.5 px-1.5 rounded flex-shrink-0 ${badgeClass(src)}`}>
                    {sourceLabel(src)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{skill.description}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 py-3" data-tauri-drag-region>
          <div className="space-y-4">
            {/* File Tree with Content Preview - Split View */}
            {skillFiles.length > 0 ? (
              <div>
                <div className="mb-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">{t('dashboard.detail.fileDirectory')}</h3>
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-dark-bg-secondary rounded-lg p-1">
                      <button
                        onClick={() => setMarkdownView('raw')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                          markdownView === 'raw'
                            ? 'bg-white dark:bg-dark-bg-tertiary shadow-sm text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                        title="显示原始文本"
                      >
                        <Icon name="code" className="text-sm" />
                        <span className="text-xs font-medium">源码</span>
                      </button>
                      <button
                        onClick={() => setMarkdownView('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                          markdownView === 'preview'
                            ? 'bg-white dark:bg-dark-bg-tertiary shadow-sm text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                        title="显示渲染预览"
                      >
                        <Icon name="visibility" className="text-sm" />
                        <span className="text-xs font-medium">预览</span>
                      </button>
                    </div>
                  </div>
                  {allPaths.map(({ source, path }) => {
                    const display = normalizePath(path, isWindows);
                    const isAgentSource = source !== SOURCE.Global;
                    const agentIcon = isAgentSource ? getAgentIcon(source) : null;
                    return (
                      <div key={`${source}:${path}`} className="flex items-center gap-1.5">
                        {agentIcon ? (
                          <img
                            src={agentIcon}
                            alt={source}
                            className={`w-3.5 h-3.5 object-contain ${needsInvertInDark(source) ? 'dark:invert' : ''}`}
                          />
                        ) : (
                          <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-3.5 h-3.5" />
                        )}
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
                        ) : markdownView === 'raw' ? (
                          <pre className="text-xs text-slate-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                            {currentFile.content}
                          </pre>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-xs prose-headings:text-xs prose-li:text-xs prose-code:text-xs">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code: (props: CodeProps) => {
                                  const { node, inline, className, children, ...rest } = props;
                                  return !inline ? (
                                    <code className={className} {...rest}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs" {...rest}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre: ({ children }) => (
                                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg overflow-x-auto text-xs">
                                    {children}
                                  </pre>
                                ),
                              }}
                            >
                              {currentFile.content}
                            </ReactMarkdown>
                          </div>
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
                    const isAgentSource = source !== SOURCE.Global;
                    const agentIcon = isAgentSource ? getAgentIcon(source) : null;
                    return (
                      <div key={`${source}:${path}`} className="flex items-center gap-1.5">
                        {agentIcon ? (
                          <img
                            src={agentIcon}
                            alt={source}
                            className={`w-3.5 h-3.5 object-contain ${needsInvertInDark(source) ? 'dark:invert' : ''}`}
                          />
                        ) : (
                          <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-3.5 h-3.5" />
                        )}
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
      </div>
    </div>
  );
};
