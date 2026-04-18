import { useTranslation } from 'react-i18next';
import type { Skill } from '@/types';

interface MarketplaceSkillCardProps {
  skill: Skill;
  onInfo: (skillId: string) => void;
  onDelete?: (skillId: string) => void;
  onAddToRoot?: (skillId: string) => void;
  isInRoot?: boolean;
}

function MarketplaceSkillCard({ skill, onInfo, onDelete, onAddToRoot, isInRoot }: MarketplaceSkillCardProps) {
  const { t } = useTranslation();

  return (
    <article className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 flex flex-col group overflow-hidden">
      <div className="p-4">
        {/* Icon + Version badge */}
        <div className="flex justify-between items-start mb-3">
          <div className={`w-12 h-12 rounded-lg ${skill.iconColor} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-2xl" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
              {skill.icon}
            </span>
          </div>
          <span className="text-[10px] font-bold py-0.5 px-1.5 bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-300 rounded uppercase">
            {skill.version}
          </span>
        </div>

        <h4 className="text-base font-bold mb-1 truncate text-slate-900 dark:text-white">{skill.name}</h4>
        <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 min-h-[2.5rem] leading-relaxed">
          {skill.description}
        </p>

        {/* Rating + Downloads */}
        {/* <div className="flex items-center gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
            <span className="text-[#191c1d] dark:text-white">{skill.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs dark:text-gray-400">download</span>
            <span className="dark:text-gray-300">{skill.downloads}</span>
          </div>
        </div> */}

        <div className="flex items-center gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            {skill.enabledAgentCount > 0 ? (
              <span className="material-symbols-outlined text-xs text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            ) : (
              <span className="material-symbols-outlined text-xs text-gray-400 dark:text-gray-500">
                radio_button_unchecked
              </span>
            )}
            <span className="text-[#191c1d] dark:text-white">{skill.enabledAgentCount}/{skill.totalAgentCount} {t('dashboard.source.agentEnabled')}</span>
          </div>
          {skill.size != null && (
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs dark:text-gray-400">folder</span>
              <span className="dark:text-gray-300">{skill.size >= 1024 ? `${(skill.size / 1024).toFixed(1)}MB` : `${skill.size}KB`}</span>
            </div>
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
            <span className="material-symbols-outlined text-base">info</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default MarketplaceSkillCard;
