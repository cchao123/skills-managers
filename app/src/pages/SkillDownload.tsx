import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDebounce, useRequest, useSet } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { appendOperationLog } from '@/pages/Dashboard/hooks/useOperationLog';
import { OperationLogPopover } from '@/pages/Dashboard/components/OperationLogPopover';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { useHiddenAgents } from '@/hooks/useHiddenAgents';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import type { SkillMetadata, AgentConfig } from '@/types';
import { useSkillModal } from '@/pages/Dashboard/hooks/useSkillModal';
import { usePanelResize } from '@/pages/Dashboard/hooks/usePanelResize';
import { SkillDetailInline } from '@/pages/Dashboard/components/SkillDetailInline';
import { skillsApi } from '@/api/tauri';
import { useSidebar } from '@/contexts/SidebarContext';
import { ResizableDetailLayout } from '@/components/ResizableDetailLayout';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  repository: string;
  branch?: string;
  stars?: number;
  /** Hot 页面专用：相对上一时段的安装数变化（带符号），其它页签为 undefined */
  change?: number;
}

type SourceType = 'allTime' | 'trending' | 'hot';

const TABS: Array<{ id: SourceType; labelKey: string; icon: string; shortcut: string }> = [
  { id: 'allTime', labelKey: 'skillDownload.tabs.allTime', icon: 'list', shortcut: '1' },
  { id: 'trending', labelKey: 'skillDownload.tabs.trending', icon: 'trending_up', shortcut: '2' },
  { id: 'hot', labelKey: 'skillDownload.tabs.hot', icon: 'local_fire_department', shortcut: '3' },
];

const IS_MAC = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// 同名但来自不同仓库的技能用 "repository::id" 区分（下载状态）
const skillKey = (skill: MarketplaceSkill) => `${skill.repository}::${skill.id}`;

// 已安装状态用 "id::source_repository" 精确匹配，无来源记录时退化为 "id"
const installedKey = (id: string, sourceRepository: string | undefined) =>
  sourceRepository ? `${id}::${sourceRepository}` : id;
const SHORTCUT_MOD = IS_MAC ? '⌘' : 'Ctrl';

// ─── 下载目标选择器 ───────────────────────────────────────────────────────────

interface AgentOption {
  id: string;
  label: string;
  icon: string;
  invertInDark: boolean;
}

function AgentPicker({ agents, selected, onSelect, isDrawerOpen }: { agents: AgentConfig[]; selected: string; onSelect: (v: string) => void; isDrawerOpen: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const options: AgentOption[] = [
    { id: 'global', label: 'Root', icon: OCTOPUS_LOGO_URL, invertInDark: false },
    ...agents.map((a) => ({ id: a.name, label: a.name, icon: getAgentIcon(a.name), invertInDark: needsInvertInDark(a.name) })),
  ];
  const current = options.find((o) => o.id === selected) ?? options[0];

  const updateAnchor = () => { if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect()); };

  useLayoutEffect(() => {
    if (!open) return;
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => { window.removeEventListener('resize', updateAnchor); window.removeEventListener('scroll', updateAnchor, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 点击 popover 与触发按钮之外区域时关闭
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const popoverStyle = anchor ? (() => {
    const width = 200;
    const margin = 8;
    const vw = window.innerWidth;
    let left = anchor.right - width;
    left = Math.max(margin, Math.min(left, vw - width - margin));
    return { position: 'fixed' as const, top: anchor.bottom + 6, left, width, zIndex: 9998 };
  })() : null;

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isDrawerOpen && (
          <span className="text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap transition-all duration-300">{t('skillDownload.storagePath')}</span>
        )}
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => { updateAnchor(); setOpen((v) => !v); }}
          className={`relative h-9 rounded-lg flex items-center transition-all duration-300 border bg-white dark:bg-dark-bg-card border-[#e1e3e4] dark:border-dark-border hover:border-slate-300 dark:hover:border-gray-600 ${isDrawerOpen ? 'w-9 px-0 justify-center' : 'px-2 gap-1.5'}`}
        >
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <img src={current.icon} alt="" className={`w-full h-full object-contain ${current.invertInDark ? 'dark:invert' : ''}`} />
          </span>
          {!isDrawerOpen && (
            <>
              <span className="text-xs font-bold text-slate-700 dark:text-white transition-all duration-300">{current.label}</span>
              <Icon name="expand_more" className="text-base text-slate-400 dark:text-gray-500" />
            </>
          )}
        </button>
      </div>

      {open && popoverStyle && createPortal(
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-lg shadow-xl py-1 select-none animate-toast-in"
        >
          <div className="px-3 py-2 border-b border-[#e1e3e4] dark:border-dark-border">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-400 font-bold">{t('skillDownload.downloadByAgent')}</span>
          </div>
          <ul className="py-1 max-h-72 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(opt.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isSelected
                      ? 'text-[#b71422] dark:text-[#fca5a5] font-semibold bg-[#fff5f6] dark:bg-[#7f1d1d]/20'
                      : 'text-slate-700 dark:text-gray-200 hover:bg-[#f3f4f5] dark:hover:bg-dark-hover'
                      }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <img src={opt.icon} alt="" className={`w-full h-full object-contain ${opt.invertInDark ? 'dark:invert' : ''}`} />
                    </span>
                    <span className="flex-1 text-left truncate flex items-center gap-1.5">
                      <span className="truncate">{opt.label}</span>
                      {opt.id === 'global' && (
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fff0f1] dark:bg-[#7f1d1d]/30 text-[#b71422] dark:text-[#fca5a5] uppercase tracking-wide">
                          {t('skillDownload.recommended')}
                        </span>
                      )}
                    </span>
                    {isSelected && <Icon name="check" className="text-base text-[#b71422] dark:text-[#fca5a5] flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── 复制命令组件 ─────────────────────────────────────────────────────────────

function CopyCommand({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 bg-[#f3f4f5] dark:bg-dark-bg-tertiary rounded-lg pl-4 pr-2 py-2.5">
      <span className="font-mono text-xs text-slate-700 dark:text-gray-300 break-all flex-1 select-all">{text}</span>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 p-1.5 rounded hover:bg-[#e1e3e4] dark:hover:bg-dark-hover transition-colors"
        title={t('skillDownload.copy')}
      >
        <Icon name={copied ? 'check' : 'content_copy'} className={`text-sm ${copied ? 'text-green-500' : 'text-slate-500 dark:text-gray-400'}`} />
      </button>
    </div>
  );
}

// ─── 详情抽屉 ────────────────────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('drawer-animation')) {
  const style = document.createElement('style');
  style.id = 'drawer-animation';
  style.textContent = `
    /* 主内容区域的宽度过渡 */
    .main-content-transition {
      transition: flex 0.3s ease-out;
    }

    /* 抽屉的宽度过渡 */
    .drawer-width-transition {
      transition: width 0.3s ease-out, flex 0.3s ease-out;
    }

    /* 抽屉内容的透明度过渡 */
    .drawer-content-transition {
      transition: opacity 0.2s ease-out;
    }
  `;
  document.head.appendChild(style);
}

interface SkillDetail {
  weekly_installs?: string;
  github_stars?: string;
  first_seen?: string;
  security_audits: { name: string; status: string }[];
}

interface DrawerProps {
  skill: MarketplaceSkill;
  installedIds: Set<string>;
  legacyInstalledIds: Set<string>;
  downloading: Set<string>;
  progress: Record<string, number>;
  succeeded: Set<string>;
  selectedAgent: string;
  onDownload: (skill: MarketplaceSkill) => void;
  onDelete: (skill: MarketplaceSkill) => void;
  onClose: () => void;
}

function MarketplaceDetailDrawer({
  skill,
  installedIds,
  legacyInstalledIds,
  downloading,
  progress,
  succeeded,
  selectedAgent,
  onDownload,
  onDelete,
  onClose,
}: DrawerProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [skillMd, setSkillMd] = useState<string | null>(null);
  const [skillMdLoading, setSkillMdLoading] = useState(true);
  const [skillMdError, setSkillMdError] = useState<string | null>(null);
  const [skillMdView, setSkillMdView] = useState<'md' | 'text'>('md');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setDetail(null);
    setDetailLoading(true);
    const source = skill.repository.replace('https://github.com/', '');
    invoke<SkillDetail>('fetch_skill_detail', { source, skillId: skill.id })
      .then(setDetail)
      .catch(() => setDetail({ security_audits: [] }))
      .finally(() => setDetailLoading(false));
  }, [skill.id]);

  // 拉取 skills.sh 详情页里渲染好的 SKILL.md（HTML 形式）
  useEffect(() => {
    setSkillMd(null);
    setSkillMdError(null);
    setSkillMdLoading(true);
    const source = skill.repository
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
    invoke<string>('fetch_marketplace_skill_content', {
      source,
      skillId: skill.id,
    })
      .then(setSkillMd)
      .catch((e) => setSkillMdError(String(e)))
      .finally(() => setSkillMdLoading(false));
  }, [skill.id, skill.repository]);

  // HTML → 纯文本：浏览器 DOM 解析后取 textContent，自动处理实体和嵌套
  const skillMdAsText = useMemo(() => {
    if (!skillMd) return '';
    const div = document.createElement('div');
    div.innerHTML = skillMd;
    return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }, [skillMd]);

  const pct = progress[skill.id] ?? 0;
  const isDownloading = downloading.has(skillKey(skill));
  const isSucceeded = succeeded.has(skillKey(skill));
  const isInstalled = installedIds.has(installedKey(skill.id, skill.repository))
    || legacyInstalledIds.has(skill.id);

  const auditStatusClass: Record<string, string> = {
    Pass: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Fail: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-bg-card">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{skill.name}</h2>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              <Icon name="person" className="text-xs flex-shrink-0" />
              <span className="truncate">{skill.author}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 描述：来自 skills.sh 详情页渲染好的 SKILL.md，可切换原文 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">{t('skillDownload.description')}</h3>
            {skillMd && !skillMdLoading && !skillMdError && (
              <div className="inline-flex items-center rounded-md border border-[#e1e3e4] dark:border-dark-border overflow-hidden text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setSkillMdView('md')}
                  aria-pressed={skillMdView === 'md'}
                  className={`px-2 py-1 transition-colors ${skillMdView === 'md'
                    ? 'bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-white'
                    : 'bg-white dark:bg-dark-bg-card text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-dark-hover'
                    }`}
                >
                  {t('skillDownload.previewMd')}
                </button>
                <button
                  type="button"
                  onClick={() => setSkillMdView('text')}
                  aria-pressed={skillMdView === 'text'}
                  className={`px-2 py-1 border-l border-[#e1e3e4] dark:border-dark-border transition-colors ${skillMdView === 'text'
                    ? 'bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-white'
                    : 'bg-white dark:bg-dark-bg-card text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-dark-hover'
                    }`}
                >
                  {t('skillDownload.previewText')}
                </button>
              </div>
            )}
          </div>
          {skillMdLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 py-3">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 dark:border-dark-bg-secondary border-t-[#b71422]"></div>
              <span>{t('skillDownload.loadingSkillMd')}</span>
            </div>
          ) : skillMdError ? (
            <div className="text-xs text-slate-500 dark:text-gray-400 italic">{t('skillDownload.skillMdError', { error: skillMdError })}</div>
          ) : skillMd ? (
            <div className="rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-[#fafbfb] dark:bg-dark-bg-tertiary overflow-hidden">
              <div className="p-3 max-h-[420px] overflow-y-auto">
                {skillMdView === 'md' ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-p:my-2 prose-pre:my-2 prose-code:text-[12px] prose-pre:text-[12px]"
                    dangerouslySetInnerHTML={{ __html: skillMd }}
                  />
                ) : (
                  <pre className="text-xs text-slate-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {skillMdAsText}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* 统计数据 */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3">{t('skillDownload.stats')}</h3>
          {detailLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 w-24 bg-slate-100 dark:bg-dark-bg-tertiary rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {skill.stars != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Icon name="download" className="text-base text-slate-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">{skill.stars.toLocaleString()}</span>
                </div>
              )}
              {detail?.weekly_installs && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Icon name="autorenew" className="text-base text-slate-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">{detail.weekly_installs}</span>
                  <span className="text-slate-500 dark:text-gray-400">{t('skillDownload.weeklyInstalls')}</span>
                </div>
              )}
              {detail?.github_stars && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Icon name="star" className="text-base text-yellow-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">{detail.github_stars}</span>
                  <span className="text-slate-500 dark:text-gray-400">GitHub Stars</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 首次出现 */}
        {!detailLoading && detail?.first_seen && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">{t('skillDownload.firstSeen')}</h3>
            <p className="text-sm text-slate-700 dark:text-gray-300">{detail.first_seen}</p>
          </div>
        )}

        {/* 安全审计 */}
        {!detailLoading && detail && detail.security_audits.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3">{t('skillDownload.securityAudits')}</h3>
            <div className="space-y-2">
              {detail.security_audits.map((audit) => (
                <div key={audit.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-dark-border last:border-0">
                  <span className="text-sm text-slate-700 dark:text-gray-300">{audit.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${auditStatusClass[audit.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {audit.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 仓库 */}
        {skill.repository && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">{t('skillDownload.repository')}</h3>
            <button
              onClick={() => openUrl(skill.repository)}
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all text-left"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 fill-current text-blue-600 dark:text-blue-400" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              {skill.repository.replace('https://github.com/', '')}
            </button>
          </div>
        )}

        {/* 安装命令 */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">{t('skillDownload.installCommand')}</h3>
          <CopyCommand text={`npx skills add ${skill.repository?.replace('https://github.com/', '') ?? skill.id} --skill ${skill.id}`} />
        </div>
      </div>

      {/* Footer：下载 / 删除按钮 */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-dark-border">
        {isInstalled && !isSucceeded ? (
          <button
            onClick={() => onDelete(skill)}
            className="w-full py-2.5 rounded-lg font-bold text-sm border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 transition-colors"
          >
            <Icon name="delete" className="text-base" />
            {t('skillDownload.uninstall')}
          </button>
        ) : isSucceeded ? (
          <div className="w-full py-2.5 rounded-lg font-bold text-sm bg-green-500 text-white flex items-center justify-center gap-2">
            <Icon name="check" className="text-base" />
            {t('skillDownload.downloadSuccess')}
          </div>
        ) : isDownloading ? (
          <div className="relative overflow-hidden w-full py-2.5 rounded-lg font-bold text-sm bg-[#f3f4f5] dark:bg-dark-bg-tertiary border border-[#e1e3e4] dark:border-dark-border cursor-not-allowed">
            <div className="absolute inset-0 bg-[#b71422] transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-white pointer-events-none" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>{pct}%</span>
            <span className="absolute inset-0 flex items-center justify-center text-[#b71422] dark:text-white pointer-events-none" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>{pct}%</span>
          </div>
        ) : (
          <button
            onClick={() => onDownload(skill)}
            className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#b71422] text-white hover:bg-[#8f0f1a] transition-colors"
          >
            {t('skillDownload.downloadTo', { target: selectedAgent === 'global' ? 'Root' : selectedAgent })}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function SkillDownload() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isCollapsed: isSidebarCollapsed, setIsCollapsed } = useSidebar();
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, { add: addDownloading, remove: removeDownloading }] = useSet<string>();
  const [succeeded, { add: addSucceeded, remove: removeSucceeded }] = useSet<string>();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [selectedAgent, setSelectedAgent] = useState<string>('global');
  const [sourceType, setSourceType] = useState<SourceType>('allTime');
  const [detailSkill, setDetailSkill] = useState<MarketplaceSkill | null>(null);
  const [previousSidebarState, setPreviousSidebarState] = useState<boolean>(true);
  const [logPopoverAnchor, setLogPopoverAnchor] = useState<DOMRect | null>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleListScroll = () => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 1000);
  };

  useEffect(() => {
    const unlisten = listen<{ skill_id: string; percent: number }>('download-progress', (e) => {
      setProgress((prev) => ({ ...prev, [e.payload.skill_id]: e.payload.percent }));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const debouncedSearch = useDebounce(searchTerm, { wait: 400 });

  const { data: skills = [], loading } = useRequest(
    () => invoke<MarketplaceSkill[]>('fetch_marketplace_skills', {
      category: debouncedSearch || null,
      sourceType: debouncedSearch ? null : sourceType,
    }),
    {
      refreshDeps: [sourceType, debouncedSearch],
      onError: (error) => showToast('error', t('skillDownload.toast.fetchListFailed', { error: String(error) })),
    },
  );

  const { data: allAgents = [] } = useRequest(() => invoke<AgentConfig[]>('get_agents'));
  const hiddenAgents = useHiddenAgents();
  const agents = useMemo(
    () => allAgents.filter((a) => a.detected && !hiddenAgents.has(a.name)),
    [allAgents, hiddenAgents],
  );

  useEffect(() => {
    if (selectedAgent !== 'global' && !agents.some((a) => a.name === selectedAgent)) {
      setSelectedAgent('global');
    }
  }, [agents, selectedAgent]);

  // Cmd/Ctrl + 1/2/3 切换 All/Trending/Hot
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tab = TABS.find((t) => t.shortcut === e.key);
      if (!tab) return;
      e.preventDefault();
      setSourceType(tab.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const {
    data: installedSkills = [] as SkillMetadata[],
    refresh: refreshInstalled,
    mutate: setInstalledSkills,
  } = useRequest(() => invoke<SkillMetadata[]>('list_skills'));

  const installedIds = useMemo(
    () => new Set(installedSkills.map((s) => installedKey(s.id, s.source_repository))),
    [installedSkills],
  );
  // 没有 .skill-source 记录的旧下载，退化为纯 id 匹配（兜底）
  const legacyInstalledIds = useMemo(
    () => new Set(installedSkills.filter((s) => !s.source_repository).map((s) => s.id)),
    [installedSkills],
  );
  const installedSkillsMap = useMemo(
    () => new Map(installedSkills.map((s) => [s.id, s])),
    [installedSkills],
  );

  // 已下载技能：用 Dashboard 的 SkillDetailModal 弹层
  const {
    detailSkill: localDetailSkill,
    showDetailModal: showLocalDetailModal,
    skillFiles,
    loadingFiles,
    expandedFolders,
    currentFile,
    loadingFile,
    handleShowSkillDetail,
    handleCloseDetailModal,
    toggleFolder,
    handleReadFile,
  } = useSkillModal();
  const { leftPanelWidth, isResizing, handleMouseDown } = usePanelResize();

  // modal 内显示的 skill 始终来自最新 installedSkills（toggle agent 后能立即反映）
  const localDetailSkillLive = useMemo(
    () =>
      localDetailSkill
        ? installedSkills.find((s) => s.id === localDetailSkill.id) ?? localDetailSkill
        : null,
    [localDetailSkill, installedSkills],
  );

  // ---- 统一详情面板：防止两种面板切换时触发宽度动画 ----
  const isAnyPanelOpen = !!(detailSkill || (showLocalDetailModal && localDetailSkillLive));
  const isAnyPanelOpenRef = useRef(isAnyPanelOpen);
  isAnyPanelOpenRef.current = isAnyPanelOpen;

  // widthOpen 用 setTimeout(0) 防抖：切换面板类型时的中间态 false 不会触发宽度收缩
  const [widthOpen, setWidthOpen] = useState(isAnyPanelOpen);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isAnyPanelOpen) {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setWidthOpen(true);
    } else {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        if (!isAnyPanelOpenRef.current) setWidthOpen(false);
      }, 0);
    }
  }, [isAnyPanelOpen]);

  // 记录最后渲染的内容供关闭动画期间继续显示
  const lastPanelTypeRef = useRef<'marketplace' | 'local' | null>(null);
  const lastMarketplaceSkillRef = useRef<typeof detailSkill>(null);
  const lastLocalSkillRef = useRef<typeof localDetailSkillLive>(null);
  if (detailSkill) {
    lastPanelTypeRef.current = 'marketplace';
    lastMarketplaceSkillRef.current = detailSkill;
  } else if (showLocalDetailModal && localDetailSkillLive) {
    lastPanelTypeRef.current = 'local';
    lastLocalSkillRef.current = localDetailSkillLive;
  }

  // 当详情弹框打开时，自动收起侧边栏
  useEffect(() => {
    const hasDrawerOpen = !!detailSkill || (showLocalDetailModal && localDetailSkillLive);
    if (hasDrawerOpen && !isSidebarCollapsed) {
      // 抽屉打开且侧边栏是展开的，收起侧边栏
      setPreviousSidebarState(isSidebarCollapsed); // 保存当前状态
      setIsCollapsed(true);
    } else if (!hasDrawerOpen && !previousSidebarState && isSidebarCollapsed) {
      // 抽屉关闭且之前是展开的，恢复展开状态
      setIsCollapsed(false);
      setPreviousSidebarState(true);
    }
  }, [detailSkill, showLocalDetailModal, localDetailSkillLive, isSidebarCollapsed, previousSidebarState, setIsCollapsed]);

  // 当侧边栏展开时，关闭所有抽屉（仅在用户主动展开侧边栏时触发）
  useEffect(() => {
    if (!isSidebarCollapsed) {
      // 侧边栏展开了，关闭所有抽屉
      if (detailSkill) {
        setDetailSkill(null);
      }
      if (showLocalDetailModal && localDetailSkillLive) {
        handleCloseDetailModal();
      }
    }
  }, [isSidebarCollapsed]);

  // 轻量版 toggle：调 API + 乐观更新本地列表，失败回滚（refresh 重拉）
  const handleToggleAgentLocal = async (skill: SkillMetadata, agentName: string) => {
    const isEnabled = skill.agent_enabled[agentName];
    setInstalledSkills((prev = []) =>
      prev.map((s) =>
        s.id === skill.id
          ? { ...s, agent_enabled: { ...s.agent_enabled, [agentName]: !isEnabled } }
          : s,
      ),
    );
    try {
      if (isEnabled) {
        await skillsApi.disable(skill.id, agentName);
      } else {
        await skillsApi.enable(skill.id, agentName);
      }
    } catch (error) {
      showToast('error', t('skillDownload.toast.toggleFailed', { agent: agentName, error: String(error) }));
      refreshInstalled();
    }
  };

  const handleDelete = async (skill: MarketplaceSkill) => {
    try {
      await invoke('delete_skill', { skillId: skill.id });
      showToast('success', t('skillDownload.toast.uninstalled', { name: skill.name }));
      refreshInstalled();
      setDetailSkill(null);
    } catch (error) {
      showToast('error', t('skillDownload.toast.uninstallFailed', { error: String(error) }));
    }
  };

  const handleDownload = async (skill: MarketplaceSkill) => {
    const key = skillKey(skill);
    if (downloading.has(key)) return;
    addDownloading(key);
    try {
      const targetAgent = selectedAgent === 'global' ? null : selectedAgent;
      await invoke('download_skill_from_marketplace', {
        skillId: skill.id,
        repository: skill.repository,
        branch: skill.branch || 'main',
        targetAgent,
      });
      addSucceeded(key);
      setTimeout(() => removeSucceeded(key), 2000);
      showToast('success', t('skillDownload.toast.downloadSuccess', { name: skill.name }));
      appendOperationLog({
        type: 'download',
        skillName: skill.name,
        downloadTarget: selectedAgent === 'global' ? 'Root' : selectedAgent,
      });
      invoke('rescan_skills');
      refreshInstalled();
    } catch (error) {
      console.error('Failed to download skill:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', t('skillDownload.toast.downloadFailed', { error: errorMessage }));
    } finally {
      removeDownloading(key);
      setProgress((prev) => { const next = { ...prev }; delete next[skill.id]; return next; });
    }
  };

  const filteredSkills = skills;

  // 基于表格容器实际宽度决定显示哪些列
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isTableScrolled, setIsTableScrolled] = useState(false);

  // 监听表格滚动，控制固定列阴影（类似 Ant Design 固定列阴影逻辑）
  useEffect(() => {
    const tableWrapper = tableContainerRef.current?.querySelector('div.overflow-x-auto') as HTMLElement;
    if (!tableWrapper) return;

    // 检查是否需要显示阴影的函数（参考 rc-table 的 onInternalScroll 逻辑）
    const checkNeedShadow = () => {
      const scrollLeft = tableWrapper.scrollLeft;
      const scrollWidth = tableWrapper.scrollWidth;
      const clientWidth = tableWrapper.clientWidth;

      // 1. 如果没有横向滚动空间，隐藏阴影
      if (scrollWidth <= clientWidth) {
        return false;
      }

      // 2. 右侧阴影：只要没有滚动到最右端，就显示阴影
      // 即：scrollLeft < scrollWidth - clientWidth
      return scrollLeft < scrollWidth - clientWidth;
    };

    // 滚动事件处理器
    const handleScroll = () => {
      setIsTableScrolled(checkNeedShadow());
    };

    // 使用 ResizeObserver 监听尺寸变化（类似 rc-table 的 onFullTableResize）
    const resizeObserver = new ResizeObserver(() => {
      setIsTableScrolled(checkNeedShadow());
    });

    // 初始化检查
    setIsTableScrolled(checkNeedShadow());

    // 监听滚动和尺寸变化
    tableWrapper.addEventListener('scroll', handleScroll);
    resizeObserver.observe(tableWrapper);

    return () => {
      tableWrapper.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  // 操作按钮：面板展开时只显示小图标，面板关闭时显示文字
  const showActionText = !isAnyPanelOpen;

  return (
    <>
    <ResizableDetailLayout
      isPanelOpen={widthOpen}
      panel={(isClosing) => (
        <>
          {(!!detailSkill || (isClosing && lastPanelTypeRef.current === 'marketplace')) && (
            <>
              {!isClosing && (
                <button
                  onClick={() => setDetailSkill(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors z-10"
                >
                  <Icon name="close" className="text-gray-600 dark:text-gray-300" />
                </button>
              )}
              <div className="h-full flex flex-col">
                <MarketplaceDetailDrawer
                  skill={(detailSkill ?? lastMarketplaceSkillRef.current)!}
                  installedIds={installedIds}
                  legacyInstalledIds={legacyInstalledIds}
                  downloading={downloading}
                  progress={progress}
                  succeeded={succeeded}
                  selectedAgent={selectedAgent}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onClose={() => { }}
                />
              </div>
            </>
          )}
          {((!detailSkill && showLocalDetailModal && !!localDetailSkillLive) || (isClosing && lastPanelTypeRef.current === 'local')) && (
            <SkillDetailInline
              skill={(localDetailSkillLive ?? lastLocalSkillRef.current)!}
              agents={agents}
              skillFiles={skillFiles}
              loadingFiles={loadingFiles}
              expandedFolders={expandedFolders}
              currentFile={currentFile}
              loadingFile={loadingFile}
              leftPanelWidth={leftPanelWidth}
              isResizing={isResizing}
              onClose={() => handleCloseDetailModal()}
              onToggleFolder={toggleFolder}
              onReadFile={handleReadFile}
              onToggleAgent={handleToggleAgentLocal}
              onDelete={async () => {
                const target = localDetailSkillLive ?? lastLocalSkillRef.current;
                if (!target) return;
                try {
                  await invoke('delete_skill', { skillId: target.id });
                  showToast('success', t('skillDownload.toast.uninstalled', { name: target.name }));
                  handleCloseDetailModal();
                  refreshInstalled();
                } catch (error) {
                  showToast('error', t('skillDownload.toast.uninstallFailed', { error: String(error) }));
                }
              }}
              onResizeStart={handleMouseDown}
            />
          )}
        </>
      )}
    >
      <div className='flex flex-col flex-1 min-h-0 bg-[#f8f9fa] dark:bg-dark-bg-secondary main-content-transition'>
        {/* 顶部：Tab + 搜索（与 Dashboard 风格一致：无白底、无分割线） */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4" data-tauri-drag-region>
          {/* 搜索和筛选栏：滑块 + 搜索框 + 下载目标，单行布局（与 Dashboard 一致） */}
          <div className="flex items-center gap-3 h-11">
            <div className="relative grid grid-cols-3 items-center rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-slate-100 dark:bg-dark-bg-tertiary p-0.5 h-9 shrink-0">
              {/* 滑动高亮块 */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-md bg-white dark:bg-dark-bg-card shadow-sm transition-all duration-200 ease-in-out"
                style={{
                  left: `calc(${TABS.findIndex((t) => t.id === sourceType)} * (100% - 4px) / 3 + 2px)`,
                  width: 'calc((100% - 4px) / 3)',
                }}
              />
              {TABS.map((tab) => {
                const isActive = sourceType === tab.id;
                return (
                  <div key={tab.id} className="relative z-10 group">
                    <button
                      onClick={() => setSourceType(tab.id)}
                      aria-pressed={isActive}
                      className="flex items-center justify-center w-full h-full gap-1.5 px-3 rounded-md transition-colors"
                    >
                      <Icon
                        name={tab.icon}
                        className={`text-lg transition-colors ${isActive
                          ? 'text-slate-700 dark:text-white'
                          : 'text-slate-400 dark:text-gray-500'
                          }`}
                      />
                      <span className={`text-xs font-bold whitespace-nowrap transition-colors ${isActive
                        ? 'text-slate-700 dark:text-white'
                        : 'text-slate-400 dark:text-gray-500'
                        }`}>{t(tab.labelKey)}</span>
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[9999] pointer-events-none hidden group-hover:block">
                      <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
                        {t(tab.labelKey)} {SHORTCUT_MOD}{tab.shortcut}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 relative">
              <div className={`flex items-center h-9 rounded-lg border bg-white dark:bg-dark-bg-card overflow-hidden transition-all duration-300 ${searchTerm ? 'border-[#b71422]/40 dark:border-[#fca5a5]/40' : 'border-[#e1e3e4] dark:border-dark-border focus-within:border-[#b71422]'
                }`}>
                <Icon name="search" className={`flex-shrink-0 text-slate-400 dark:text-gray-400 transition-all duration-300 ${detailSkill || (showLocalDetailModal && localDetailSkillLive) ? 'ml-2' : 'ml-3'}`} />
                <input
                  type="text"
                  placeholder={t('skillDownload.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`flex-1 h-full w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all duration-300 pl-2 ${detailSkill || (showLocalDetailModal && localDetailSkillLive) ? 'pr-6' : 'pr-3'}`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-dark-bg-tertiary flex-shrink-0 transition-all duration-300 ${detailSkill || (showLocalDetailModal && localDetailSkillLive) ? 'w-4 h-4 mr-1' : 'w-5 h-5 right-2'}`}
                    title={t('skillDownload.clear')}
                  >
                    <Icon name="close" className={`text-slate-400 dark:text-gray-500 ${detailSkill || (showLocalDetailModal && localDetailSkillLive) ? 'text-xs' : 'text-sm'}`} />
                  </button>
                )}
              </div>
            </div>

            <AgentPicker agents={agents} selected={selectedAgent} onSelect={setSelectedAgent} isDrawerOpen={!!(detailSkill || (showLocalDetailModal && localDetailSkillLive))} />
          </div>
        </div>

        {/* 主内容区：左右布局 */}
        <div className="flex-1 min-h-0 flex overflow-hidden px-5 pb-5">
          {/* 左边：技能列表 */}
          <div ref={tableContainerRef} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            {/* 技能列表 */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center backdrop-blur-md bg-white/40 dark:bg-dark-bg-card/40 rounded-xl border border-white/40 dark:border-white/10 min-h-0">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-dark-bg-secondary border-t-[#b71422] mx-auto mb-3"></div>
                  <p className="text-xs font-bold text-slate-600 dark:text-gray-300">{t('skillDownload.loading')}</p>
                </div>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center min-h-0">
                <Icon name="extension" className="text-6xl text-slate-300 dark:text-gray-600 mb-4" />
                <p className="text-slate-600 dark:text-gray-400">
                  {searchTerm ? t('skillDownload.notFound') : t('skillDownload.marketplaceEmpty')}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border flex flex-col flex-1 min-h-0 overflow-hidden">
                <div onScroll={handleListScroll} className="overflow-x-auto overflow-y-auto flex-1 min-h-0 overscroll-x-contain overscroll-behavior-x-none" style={{ overscrollBehaviorX: 'none' }}>
                  <table className="w-full min-w-[900px]">
                    <colgroup>
                      <col className="w-14" />
                      <col />
                      <col className="w-56" />
                      <col className="w-36" />
                      <col className={showActionText ? "w-36" : "w-16"} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-[#f9fafb] dark:bg-dark-bg-tertiary shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">{t('skillDownload.column.skill')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border overflow-hidden whitespace-nowrap">{t('skillDownload.column.author')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border overflow-hidden whitespace-nowrap">
                          {sourceType === 'hot' ? t('skillDownload.column.installs1hChange') : t('skillDownload.column.installs')}
                        </th>
                        <th className={`sticky right-0 ${showActionText ? 'px-4' : 'px-2'} py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border bg-[#f9fafb] dark:bg-dark-bg-tertiary ${isTableScrolled ? 'shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''} transition-shadow duration-200`}>{t('skillDownload.column.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e1e3e4] dark:divide-dark-border">
                      {filteredSkills.map((skill, index) => {
                        const isSelected = detailSkill?.id === skill.id || localDetailSkillLive?.id === skill.id;
                        const cellBgClass = isSelected ? 'bg-red-50 dark:bg-red-900/20' : '';
                        const actionCellBgClass = isSelected ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-dark-bg-card';
                        return (
                          <tr
                            key={skill.id}
                            className="hover:bg-[#fafbfb] dark:hover:bg-dark-hover transition-colors group cursor-pointer"
                            onClick={() => {
                              const localSkill = installedSkillsMap.get(skill.id);
                              if (localSkill) {
                                setDetailSkill(null); // 关闭 marketplace 详情
                                handleShowSkillDetail(localSkill);
                              } else {
                                handleCloseDetailModal(); // 关闭本地详情
                                setDetailSkill(skill);
                              }
                            }}
                          >
                            {/* # 序号 */}
                            <td className={`px-4 py-3 align-middle text-sm font-bold text-slate-500 dark:text-gray-400 ${cellBgClass}`}>
                              #{index + 1}
                            </td>

                            {/* 技能：名称 + 描述 */}
                            <td className={`px-4 py-3 align-middle ${cellBgClass}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{skill.name}</div>
                                <div className="text-xs text-[#5e5e5e] dark:text-gray-400 truncate leading-relaxed">{skill.description}</div>
                              </div>
                            </td>

                            {/* 作者 */}
                            <td className={`px-4 py-3 align-middle overflow-hidden whitespace-nowrap ${cellBgClass}`}>
                              <button
                                onClick={(e) => { e.stopPropagation(); openUrl(skill.repository); }}
                                className="inline-flex items-center gap-1 max-w-full hover:text-[#b71422] dark:hover:text-[#fca5a5] transition-colors"
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0 fill-current text-slate-400 dark:text-gray-500 group-hover:text-[#b71422] dark:group-hover:text-[#fca5a5]" aria-hidden="true">
                                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                                <span className="text-xs font-bold text-slate-600 dark:text-gray-300 truncate">{skill.author}</span>
                              </button>
                            </td>

                            {/* 下载量 / Hot 模式：1H + Change */}
                            <td className={`px-4 py-3 align-middle overflow-hidden whitespace-nowrap ${cellBgClass}`}>
                              {skill.stars != null ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="flex items-center gap-1">
                                    <Icon name="download" className="text-sm text-slate-400 dark:text-gray-500" />
                                    <span className="font-bold text-[#191c1d] dark:text-white">{skill.stars.toLocaleString()}</span>
                                  </div>
                                  {skill.change != null && (
                                    <span
                                      className={`font-bold tabular-nums ${skill.change > 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : skill.change < 0
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-slate-500 dark:text-gray-400'
                                        }`}
                                    >
                                      {skill.change > 0 ? '+' : ''}{skill.change.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-gray-500">—</span>
                              )}
                            </td>

                            {/* 操作：下载 */}
                            <td className={`sticky right-0 ${showActionText ? 'px-4' : 'px-2'} py-3 align-middle ${actionCellBgClass} ${isTableScrolled ? 'shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''} transition-shadow duration-200`}>
                              <div className="flex items-center justify-center">
                                {(installedIds.has(installedKey(skill.id, skill.repository)) || legacyInstalledIds.has(skill.id)) && !succeeded.has(skillKey(skill)) ? (
                                  <div
                                    className={`h-8 rounded-md font-bold text-xs bg-white dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-400 flex items-center justify-center gap-1 cursor-not-allowed transition-all duration-300 ${showActionText ? 'w-32' : 'w-8'}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Icon name="check_circle" className="text-sm" />
                                    {showActionText && <span className="truncate">{t('skillDownload.installed')}</span>}
                                  </div>
                                ) : succeeded.has(skillKey(skill)) ? (
                                  <div
                                    className={`h-8 rounded-md font-bold text-xs bg-green-500 text-white flex items-center justify-center gap-1 transition-all duration-300 ${showActionText ? 'w-32' : 'w-8'}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Icon name="check" className="text-sm" />
                                    {showActionText && <span className="truncate">{t('skillDownload.downloadSuccess')}</span>}
                                  </div>
                                ) : downloading.has(skillKey(skill)) ? (
                                  <div
                                    className={`relative overflow-hidden h-8 rounded-md font-bold text-xs bg-[#f3f4f5] dark:bg-dark-bg-tertiary border border-[#e1e3e4] dark:border-dark-border cursor-not-allowed transition-all duration-300 ${showActionText ? 'w-32' : 'w-8'}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      className="absolute inset-0 bg-[#b71422] transition-[width] duration-300 ease-out"
                                      style={{ width: `${progress[skill.id] ?? 0}%` }}
                                    />
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-white pointer-events-none"
                                      style={{ clipPath: `inset(0 ${100 - (progress[skill.id] ?? 0)}% 0 0)` }}
                                    >{progress[skill.id] ?? 0}%</span>
                                    <span
                                      className="absolute inset-0 flex items-center justify-center text-[#b71422] dark:text-white pointer-events-none"
                                      style={{ clipPath: `inset(0 0 0 ${progress[skill.id] ?? 0}%)` }}
                                    >{progress[skill.id] ?? 0}%</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(skill);
                                    }}
                                    className={`h-8 rounded-md font-bold text-xs bg-[#b71422] text-white hover:bg-[#8f0f1a] transition-all duration-300 flex items-center justify-center gap-1 ${showActionText ? 'w-32 px-2' : 'w-8'}`}
                                    title={selectedAgent === 'global'
                                      ? t('skillDownload.download')
                                      : t('skillDownload.downloadTo', { target: selectedAgent })}
                                  >
                                    <Icon name="download" className="text-sm" />
                                    {showActionText && (
                                      <span className="truncate">
                                        {selectedAgent === 'global'
                                          ? t('skillDownload.download')
                                          : t('skillDownload.downloadTo', { target: selectedAgent })}
                                      </span>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </ResizableDetailLayout>

      {/* 下载记录悬浮按钮：日志弹出时收起 */}
      <div className={`fixed bottom-6 right-6 z-40 transition-transform duration-300 ${(isAnyPanelOpen || isScrolling) ? 'translate-x-[calc(100%+1.5rem)]' : ''}`}>
        <div className="relative group">
          <button
            ref={logButtonRef}
            onClick={() => {
              if (logButtonRef.current) setLogPopoverAnchor(logButtonRef.current.getBoundingClientRect());
            }}
            className="w-9 h-9 rounded-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all"
          >
            <Icon name="history" className="text-base text-slate-500 dark:text-gray-400" />
          </button>
          <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:block">
            <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
              {t('skillDownload.downloadLog')}
            </div>
          </div>
        </div>
      </div>

      {/* 下载记录弹出层 */}
      {logPopoverAnchor && (
        <OperationLogPopover
          anchorRect={logPopoverAnchor}
          onClose={() => setLogPopoverAnchor(null)}
          openAbove
          filterTypes={['download']}
          panelTitle={t('skillDownload.downloadLogTitle')}
          emptyMessage={t('skillDownload.downloadLogEmpty')}
        />
      )}
    </>
  );
}
