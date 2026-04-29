import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
/**
 * 预览环境下对"需要桌面原生能力"的 Settings tab（Agents / Advanced）
 * 渲染的占位卡片。视觉风格和其他 Settings section 对齐（白底圆角 + 内容中置）。
 */
interface PreviewLockedSectionProps {
  feature: 'agents' | 'advanced';
}

const COPY = {
  agents: {
    titleZh: 'Agent 管理仅桌面端可用',
    descZh: '扫描 Claude / Cursor / Codex 等 Agent 的原生目录、展示检测状态、打开本地文件夹，都依赖桌面原生能力。',
    titleEn: 'Agent management is desktop-only',
    descEn: 'Scanning Claude / Cursor / Codex native folders, showing detection status and opening local paths requires desktop-native capabilities.',
  },
  advanced: {
    titleZh: '高级选项仅桌面端可用',
    descZh: '技能前缀过滤、隐藏规则、符号链接策略等高级配置会真实修改你的本地文件系统，只在桌面版里开放。',
    titleEn: 'Advanced options are desktop-only',
    descEn: 'Skill prefix filters, hide rules and symlink strategy change your local filesystem — desktop-only by design.',
  },
} as const;

export function PreviewLockedSection({ feature }: PreviewLockedSectionProps) {
  const { i18n } = useTranslation();
  const copy = COPY[feature];
  const isZh = i18n.language?.toLowerCase().startsWith('zh');
  const title = isZh ? copy.titleZh : copy.titleEn;
  const desc = isZh ? copy.descZh : copy.descEn;

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-10 shadow-sm border border-[#e1e3e4] dark:border-dark-border flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#b71422]/10 text-[#b71422] flex items-center justify-center mb-4">
        <Icon name="lock" style={{ fontSize: '28px' }} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-['Manrope']">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed max-w-lg mb-6">
        {desc}
      </p>
      <a
        href="https://github.com/cchao123/skills-managers/releases"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#b71422] hover:bg-[#d81a2c] text-white font-bold text-sm transition-colors shadow-sm"
      >
        <Icon name="download" style={{ fontSize: '18px' }} />
        {isZh ? '下载桌面版' : 'Download desktop app'}
      </a>
    </div>
  );
}
