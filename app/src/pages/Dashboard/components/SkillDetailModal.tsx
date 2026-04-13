import type { SkillMetadata, AgentConfig, SkillFileEntry } from '@/types';
import { getSkillIcon, getSkillColor } from '@/pages/Dashboard/utils/skillHelpers';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import CardFileTree from '@/components/CardFileTree';
import { FILE_TREE_HEIGHT } from '@/pages/Dashboard/constants/panel';
import { agentsApi } from '@/api/tauri';

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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-xl w-[65%] max-w-[1400px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg ${getSkillColor(skill.id)} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-2xl">
                  {getSkillIcon(skill.id)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white">{skill.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">v{skill.version || '1.0.0'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">close</span>
            </button>
          </div>
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{skill.description}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-20">
          <div className="space-y-4">
            {/* Path */}
            {/* File Tree with Content Preview - Split View */}
            {skillFiles.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">文件目录：</h3>
                  {skill.path && (
                    <p
                      className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate flex-1 min-w-0 cursor-pointer hover:underline"
                      title={skill.path}
                      onClick={() => agentsApi.openFolderPath(skill.path!)}
                    >
                      {skill.path}
                    </p>
                  )}
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
                    title="拖拽调整宽度"
                  >
                    {/* Drag handle indicator */}
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
                          <span className="material-symbols-outlined text-3xl mb-2">description</span>
                          <p className="text-xs">点击文件查看内容</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">文件目录：</h3>
                  {skill.path && (
                    <p
                      className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate flex-1 min-w-0 cursor-pointer hover:underline"
                      title={skill.path}
                      onClick={() => agentsApi.openFolderPath(skill.path!)}
                    >
                      {skill.path}
                    </p>
                  )}
                </div>
                <div className="bg-[#fafafa] dark:bg-dark-bg-secondary rounded-lg p-6" style={{ height: FILE_TREE_HEIGHT }}>
                  {loadingFiles ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-dark-bg-secondary border-t-[#b71422] mb-3"></div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">加载文件列表中...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500 mb-2">folder_open</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">暂无文件</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">该技能目录下没有找到文件</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agent Status */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Agent 启用状态：</h3>
              <div className="bg-[#fafafa] dark:bg-dark-bg-secondary rounded-lg px-3 py-3 relative pb-1">
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary relative">
          {skill.source === 'global' && (
            <button
              onClick={onDelete}
              className="w-12 h-12 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors absolute left-1/2 -translate-x-1/2 bottom-4 shadow-lg"
              title="删除技能"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
