import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDebounce, useRequest, useSet } from 'ahooks';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { open as openUrl } from '@tauri-apps/plugin-shell';

const ICON_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
];

const getIconColor = (id: string) => {
  const index = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % ICON_COLORS.length;
  return ICON_COLORS[index];
};

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  repository: string;
  branch?: string;
  stars?: number;
}

interface Agent {
  name: string;
  path: string;
  enabled: boolean;
  detected: boolean;
  skills_path: string;
}

type SourceType = 'allTime' | 'trending' | 'hot';

const TABS: Array<{ id: SourceType; label: string }> = [
  { id: 'allTime', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'hot', label: 'Hot' },
];

const TITLE_MAP: Record<SourceType, string> = {
  allTime: 'All Skills',
  trending: 'Trending Skills',
  hot: 'Hot Skills',
};

// ─── 下载目标选择器 ───────────────────────────────────────────────────────────

interface AgentOption {
  id: string;
  label: string;
  icon: string;
  invertInDark: boolean;
}

function AgentPicker({ agents, selected, onSelect }: { agents: Agent[]; selected: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const options: AgentOption[] = [
    { id: 'global', label: '全局', icon: OCTOPUS_LOGO_URL, invertInDark: false },
    ...agents.map((a) => ({ id: a.name, label: a.name, icon: getAgentIcon(a.name), invertInDark: needsInvertInDark(a.name) })),
  ];
  const current = options.find((o) => o.id === selected) ?? options[0];

  const updateAnchor = () => { if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect()); };
  const scheduleClose = () => { closeTimer.current = setTimeout(() => setOpen(false), 100); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

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
        <span className="text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">下载到</span>
        <button
          ref={buttonRef}
          type="button"
          onMouseEnter={() => { cancelClose(); updateAnchor(); setOpen(true); }}
          onMouseLeave={scheduleClose}
          className="relative h-9 px-2 rounded-lg flex items-center gap-1.5 transition-colors border bg-white dark:bg-dark-bg-card border-[#e1e3e4] dark:border-dark-border hover:border-slate-300 dark:hover:border-gray-600"
        >
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <img src={current.icon} alt="" className={`w-full h-full object-contain ${current.invertInDark ? 'dark:invert' : ''}`} />
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-white">{current.label}</span>
          <Icon name="expand_more" className="text-base text-slate-400 dark:text-gray-500" />
        </button>
      </div>

      {open && popoverStyle && createPortal(
        <div
          style={popoverStyle}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-lg shadow-xl py-1 select-none animate-toast-in"
        >
          <div className="px-3 py-2 border-b border-[#e1e3e4] dark:border-dark-border">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-400 font-bold">按 Agent 下载</span>
          </div>
          <ul className="py-1 max-h-72 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(opt.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'text-[#b71422] dark:text-[#fca5a5] font-semibold bg-[#fff5f6] dark:bg-[#7f1d1d]/20'
                        : 'text-slate-700 dark:text-gray-200 hover:bg-[#f3f4f5] dark:hover:bg-dark-hover'
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <img src={opt.icon} alt="" className={`w-full h-full object-contain ${opt.invertInDark ? 'dark:invert' : ''}`} />
                    </span>
                    <span className="flex-1 text-left truncate">{opt.label}</span>
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
        title="复制"
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
    @keyframes drawerSlideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    .drawer-animate-in { animation: drawerSlideIn 0.3s ease-out forwards; }
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
  downloading,
  progress,
  succeeded,
  selectedAgent,
  onDownload,
  onDelete,
  onClose,
}: DrawerProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

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

  const pct = progress[skill.id] ?? 0;
  const isDownloading = downloading.has(skill.id);
  const isSucceeded = succeeded.has(skill.id);
  const isInstalled = installedIds.has(skill.id);

  const auditStatusClass: Record<string, string> = {
    Pass: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Fail: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-[480px] max-w-[90vw] bg-white dark:bg-dark-bg-card shadow-2xl flex flex-col drawer-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
          >
            <Icon name="close" className="text-gray-600 dark:text-gray-300" />
          </button>

          <div className="flex items-center gap-4 pr-10">
            <div className={`w-14 h-14 rounded-xl ${getIconColor(skill.id)} flex items-center justify-center flex-shrink-0`}>
              <Icon name="extension" className="text-3xl" />
            </div>
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
          {/* 描述 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">描述</h3>
            <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
              {skill.description || '暂无描述'}
            </p>
          </div>

          {/* 统计数据 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3">统计</h3>
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
                    <span className="text-slate-500 dark:text-gray-400">总安装量</span>
                  </div>
                )}
                {detail?.weekly_installs && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Icon name="autorenew" className="text-base text-slate-400" />
                    <span className="font-semibold text-slate-900 dark:text-white">{detail.weekly_installs}</span>
                    <span className="text-slate-500 dark:text-gray-400">周安装</span>
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">首次收录</h3>
              <p className="text-sm text-slate-700 dark:text-gray-300">{detail.first_seen}</p>
            </div>
          )}

          {/* 安全审计 */}
          {!detailLoading && detail && detail.security_audits.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3">安全审计</h3>
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">仓库</h3>
              <button
                onClick={() => openUrl(skill.repository)}
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all text-left"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 fill-current text-blue-600 dark:text-blue-400" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                {skill.repository.replace('https://github.com/', '')}
              </button>
            </div>
          )}

          {/* 安装命令 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">安装命令</h3>
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
              卸载技能
            </button>
          ) : isSucceeded ? (
            <div className="w-full py-2.5 rounded-lg font-bold text-sm bg-green-500 text-white flex items-center justify-center gap-2">
              <Icon name="check" className="text-base" />
              下载成功
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
              下载到 {selectedAgent === 'global' ? '全局' : selectedAgent}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function SkillDownload() {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, { add: addDownloading, remove: removeDownloading }] = useSet<string>();
  const [succeeded, { add: addSucceeded, remove: removeSucceeded }] = useSet<string>();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [selectedAgent, setSelectedAgent] = useState<string>('global');
  const [sourceType, setSourceType] = useState<SourceType>('allTime');
  const [detailSkill, setDetailSkill] = useState<MarketplaceSkill | null>(null);

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
      onError: (error) => showToast('error', `获取技能市场列表失败: ${String(error)}`),
    },
  );

  const { data: agents = [] } = useRequest(async () => {
    const result = await invoke<Agent[]>('get_agents');
    return result.filter((a) => a.detected);
  });

  const { data: installedIds = new Set<string>(), refresh: refreshInstalled } = useRequest(async () => {
    const list = await invoke<{ id: string }[]>('list_skills');
    return new Set(list.map((s) => s.id));
  });

  const handleDelete = async (skill: MarketplaceSkill) => {
    try {
      await invoke('delete_skill', { skillId: skill.id });
      showToast('success', `已卸载技能: ${skill.name}`);
      refreshInstalled();
      setDetailSkill(null);
    } catch (error) {
      showToast('error', `卸载失败: ${String(error)}`);
    }
  };

  const handleDownload = async (skill: MarketplaceSkill) => {
    if (downloading.has(skill.id)) return;
    addDownloading(skill.id);
    try {
      const targetAgent = selectedAgent === 'global' ? null : selectedAgent;
      await invoke('download_skill_from_marketplace', {
        skillId: skill.id,
        repository: skill.repository,
        branch: skill.branch || 'main',
        targetAgent,
      });
      addSucceeded(skill.id);
      setTimeout(() => removeSucceeded(skill.id), 2000);
      showToast('success', `成功下载技能: ${skill.name}`);
      invoke('rescan_skills');
      refreshInstalled();
    } catch (error) {
      console.error('Failed to download skill:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', `下载失败: ${errorMessage}`);
    } finally {
      removeDownloading(skill.id);
      setProgress((prev) => { const next = { ...prev }; delete next[skill.id]; return next; });
    }
  };

  const filteredSkills = skills;

  return (
    <div className="h-full overflow-y-auto">
      {/* 吸顶头部：Tab + 搜索 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-bg-card border-b border-slate-200 dark:border-dark-border px-6 pt-4 pb-3 space-y-3">
        <div className="max-w-7xl mx-auto space-y-3">
        {/* 搜索和筛选栏 */}
        <div className="space-y-3">
          <div className="flex gap-2 border-b border-slate-200 dark:border-dark-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSourceType(tab.id)}
                className={`px-4 py-2 font-medium transition-all border-b-2 ${
                  sourceType === tab.id
                    ? 'border-[#b71422] text-[#b71422] dark:text-[#ff4d4d]'
                    : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="搜索技能..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-bg-card text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#b71422] focus:border-transparent"
              />
            </div>

            <AgentPicker agents={agents} selected={selectedAgent} onSelect={setSelectedAgent} />
          </div>
        </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* 技能列表标题 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {TITLE_MAP[sourceType]}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-gray-400">
              共 {filteredSkills.length} 个技能
            </span>
          </h2>
        </div>

        {/* 技能列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b71422] mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-gray-400">加载中...</p>
            </div>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="extension" className="text-6xl text-slate-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-gray-400">
              {searchTerm ? '未找到匹配的技能' : '技能市场暂时为空'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <article
                key={skill.id}
                className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border hover:shadow-lg hover:border-[#b71422]/20 transition-all duration-300 flex flex-col group overflow-hidden"
              >
                <div className="p-4">
                  {/* Icon + GitHub author link */}
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-12 h-12 rounded-lg ${getIconColor(skill.id)} flex items-center justify-center`}>
                      <Icon name="extension" className="text-2xl" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openUrl(skill.repository); }}
                      className="flex items-center gap-1 max-w-[55%] hover:text-[#b71422] dark:hover:text-[#fca5a5] transition-colors group"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0 fill-current text-slate-400 dark:text-gray-500 group-hover:text-[#b71422] dark:group-hover:text-[#fca5a5]" aria-hidden="true">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                      </svg>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 truncate group-hover:text-[#b71422] dark:group-hover:text-[#fca5a5]">@{skill.author}</span>
                    </button>
                  </div>

                  <h4 className="text-base font-bold mb-1 truncate text-slate-900 dark:text-white">{skill.name}</h4>
                  <p className="text-xs text-[#5e5e5e] dark:text-gray-300 mb-4 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {skill.description}
                  </p>

                  {/* 下载数 */}
                  {skill.stars != null && (
                    <div className="flex items-center gap-1 mb-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
                      <Icon name="download" className="text-xs text-slate-400 dark:text-gray-500" />
                      <span className="text-[#191c1d] dark:text-white">{skill.stars.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-2">
                    {installedIds.has(skill.id) && !succeeded.has(skill.id) ? (
                      <div className="flex-1 py-2 rounded-lg font-bold text-xs bg-[#edeeef] dark:bg-dark-bg-tertiary text-[#5e5e5e] dark:text-gray-400 flex items-center justify-center gap-1 cursor-not-allowed">
                        <Icon name="check_circle" className="text-sm" />
                        已下载
                      </div>
                    ) : succeeded.has(skill.id) ? (
                      <div className="flex-1 py-2 rounded-lg font-bold text-xs bg-green-500 text-white flex items-center justify-center gap-1">
                        <Icon name="check" className="text-sm" />
                        下载成功
                      </div>
                    ) : downloading.has(skill.id) ? (
                      <div className="relative overflow-hidden flex-1 py-2 rounded-lg font-bold text-xs bg-[#f3f4f5] dark:bg-dark-bg-tertiary border border-[#e1e3e4] dark:border-dark-border cursor-not-allowed">
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
                        onClick={() => handleDownload(skill)}
                        className="flex-1 py-2 rounded-lg font-bold text-xs bg-[#b71422] text-white hover:bg-[#8f0f1a] transition-colors"
                      >
                        下载到 {selectedAgent === 'global' ? '全局' : selectedAgent}
                      </button>
                    )}

                    {/* 详情按钮 */}
                    <button
                      onClick={() => setDetailSkill(skill)}
                      className="w-9 h-9 border border-[#e1e3e4] dark:border-dark-border bg-[#f3f4f5] dark:bg-dark-bg-tertiary text-slate-600 dark:text-gray-300 rounded-lg flex items-center justify-center hover:bg-[#edeeef] dark:hover:bg-dark-hover transition-colors flex-shrink-0"
                    >
                      <Icon name="info" className="text-base" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* 详情抽屉 */}
      {detailSkill && (
        <MarketplaceDetailDrawer
          skill={detailSkill}
          installedIds={installedIds}
          downloading={downloading}
          progress={progress}
          succeeded={succeeded}
          selectedAgent={selectedAgent}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onClose={() => setDetailSkill(null)}
        />
      )}
    </div>
  );
}
