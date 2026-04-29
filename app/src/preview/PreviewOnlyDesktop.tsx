import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PAGE, pageToPath } from '@/constants';

import { Icon } from '@/components/Icon';
/**
 * 非 Dashboard 路由在预览模式下的占位页。
 *
 * 这些页面涉及本地文件系统（Settings / Agents 发现）、私密 token（GitHub Backup）
 * 或桌面托盘，无法在浏览器里还原，明确引导用户下载桌面版。
 */
interface PreviewOnlyDesktopProps {
  /** 当前被拦截的页面，用于标题和跳转按钮 */
  feature: 'github' | 'settings';
}

const COPY: Record<PreviewOnlyDesktopProps['feature'], { titleZh: string; descZh: string; titleEn: string; descEn: string }> = {
  github: {
    titleZh: 'GitHub 备份仅桌面端可用',
    descZh: '这里会把你的技能库一键同步到 GitHub 私有仓库。因为需要 Personal Access Token 和本地 Git 能力，浏览器环境无法安全提供。',
    titleEn: 'GitHub backup is desktop-only',
    descEn: 'Sync your whole skills library to a GitHub repo with one click. Requires a Personal Access Token and local Git access — not available in the browser preview.',
  },
  settings: {
    titleZh: '设置页仅桌面端可用',
    descZh: 'Agent 发现、链接策略、托盘偏好等能力依赖本地文件系统和原生窗口 API，只在桌面版里可用。',
    titleEn: 'Settings are desktop-only',
    descEn: 'Agent discovery, link strategy and tray preferences rely on native file-system and window APIs, only available in the desktop app.',
  },
};

export default function PreviewOnlyDesktop({ feature }: PreviewOnlyDesktopProps) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const copy = COPY[feature];
  const isZh = i18n.language?.toLowerCase().startsWith('zh');
  const title = isZh ? copy.titleZh : copy.titleEn;
  const desc = isZh ? copy.descZh : copy.descEn;

  return (
    <div className="h-full w-full flex items-center justify-center px-8">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[#b71422]/10 text-[#b71422] flex items-center justify-center">
          <Icon name="download_for_offline" style={{ fontSize: '32px' }} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-['Manrope'] mb-3">
          {title}
        </h2>
        <p className="text-slate-600 dark:text-gray-300 leading-relaxed mb-8">{desc}</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://github.com/cchao123/skills-managers/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#b71422] hover:bg-[#d81a2c] text-white font-bold text-sm transition-colors shadow-sm"
          >
            <Icon name="download" style={{ fontSize: '18px' }} />
            {isZh ? '下载桌面版' : 'Download desktop app'}
          </a>
          <button
            type="button"
            onClick={() => navigate(pageToPath(PAGE.Dashboard))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-slate-700 dark:text-gray-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors"
          >
            <Icon name="arrow_back" style={{ fontSize: '18px' }} />
            {isZh ? '返回 Dashboard' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
