import type { Skill } from '@/types/skills';

interface MarketplaceSkillCardProps {
  skill: Skill;
  onInstall: (skillId: string) => void;
  onInfo: (skillId: string) => void;
  collectedStatus?: 'collected' | 'uncollected';
}

function MarketplaceSkillCard({ skill, onInstall, onInfo, collectedStatus }: MarketplaceSkillCardProps) {
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
        <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 leading-relaxed">
          {skill.description}
        </p>

        {/* Rating + Downloads */}
        <div className="flex items-center gap-3 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
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
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {collectedStatus !== undefined ? (
            /* 收录标签 — 纯展示，不可点击 */
            <div className={`flex-1 py-2 rounded-lg font-bold text-xs text-center ${
              collectedStatus === 'collected'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-400 border border-[#e1e3e4] dark:border-dark-border'
            }`}>
              {collectedStatus === 'collected' ? '已收录' : '收录'}
            </div>
          ) : (
            /* Install 按钮 — 原有逻辑 */
            <button
              onClick={() => onInstall(skill.id)}
              className="flex-1 bg-[#b71422] text-white py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
            >
              {skill.installed ? 'Installed' : 'Install'}
            </button>
          )}
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
