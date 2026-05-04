import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
/**
 * 预览环境下对"需要桌面原生能力"的 Settings tab（Agents / Advanced）
 * 渲染的占位卡片。视觉风格和其他 Settings section 对齐（白底圆角 + 内容中置）。
 */
interface PreviewLockedSectionProps {
  feature: 'agents' | 'advanced';
}

export function PreviewLockedSection({ feature }: PreviewLockedSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-10 shadow-sm border border-[#e1e3e4] dark:border-dark-border flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#b71422]/10 text-[#b71422] flex items-center justify-center mb-4">
        <Icon name="lock" style={{ fontSize: '28px' }} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-['Manrope']">
        {feature === 'agents' ? t('settings.previewLocked.agentsTitle') : t('settings.previewLocked.advancedTitle')}
      </h3>
      <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed max-w-lg mb-6">
        {feature === 'agents' ? t('settings.previewLocked.agentsDesc') : t('settings.previewLocked.advancedDesc')}
      </p>
      <a
        href="https://github.com/cchao123/skills-managers/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#b71422] hover:bg-[#d81a2c] text-white font-bold text-sm transition-colors shadow-sm"
      >
        <Icon name="download" style={{ fontSize: '18px' }} />
        {t('settings.previewLocked.downloadApp')}
      </a>
    </div>
  );
}
