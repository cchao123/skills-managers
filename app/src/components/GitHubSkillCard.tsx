import type { GitHubSkill } from '../types';

interface GitHubSkillCardProps {
  skill: GitHubSkill;
  onInfo: () => void;
  onInstall: () => void;
}

export default function GitHubSkillCard({ skill, onInfo, onInstall }: GitHubSkillCardProps) {

  const getStatusBadge = () => {
    switch (skill.install_status) {
      case 'installed':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md">
            <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
            <span className="text-xs font-medium text-green-700">
              已启用 ({skill.enabled_agents.length})
            </span>
          </div>
        );
      case 'downloaded':
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <span className="material-symbols-outlined text-sm text-blue-600">download</span>
            <span className="text-xs font-medium text-blue-700">已下载</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
            <span className="material-symbols-outlined text-sm text-gray-500">download</span>
            <span className="text-xs font-medium text-gray-500">可安装</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          {/* 图标 */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#dc2626] to-[#b91c1c] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-xl text-white">extension</span>
          </div>

          {/* 标题和状态 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate mb-1">
              {skill.name}
            </h3>
            {getStatusBadge()}
          </div>
        </div>

        {/* 描述 */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3">
          {skill.description}
        </p>

        {/* 元信息 */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>分类: {skill.category}</span>
          <span>•</span>
          <span>⭐ {skill.stars}</span>
          <span>•</span>
          <span>👤 {skill.author}</span>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onInfo}
            className="flex-1 px-4 py-2 border border-[#e1e3e4] dark:border-dark-border rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors"
          >
            详情
          </button>
          <button
            onClick={onInstall}
            className="flex-1 px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={skill.install_status === 'installed'}
          >
            {skill.install_status === 'installed' ? '已安装' : '安装'}
          </button>
        </div>
      </div>
    </div>
  );
}
