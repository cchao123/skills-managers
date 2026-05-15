import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { ResizableDetailLayout } from '@/components/ResizableDetailLayout';

interface MarketplaceSkill {
  id: string;
  name: string;
  author: string;
  stars?: number;
  change?: number;
}

type SourceType = 'allTime' | 'trending' | 'hot';

const TABS: Array<{ id: SourceType; labelKey: string; icon: string }> = [
  { id: 'allTime', labelKey: 'skillDownload.tabs.allTime', icon: 'list' },
  { id: 'trending', labelKey: 'skillDownload.tabs.trending', icon: 'trending_up' },
  { id: 'hot', labelKey: 'skillDownload.tabs.hot', icon: 'local_fire_department' },
];

// ─── 真实数据来自 skills.sh（2025-05）────────────────────────────────────────

const MOCK_ALL_TIME: MarketplaceSkill[] = [
  { id: 'find-skills', name: 'find-skills', author: 'vercel-labs', stars: 1500000 },
  { id: 'frontend-design', name: 'frontend-design', author: 'anthropics', stars: 406140 },
  { id: 'vercel-react-best-practices', name: 'vercel-react-best-practices', author: 'vercel-labs', stars: 395936 },
  { id: 'web-design-guidelines', name: 'web-design-guidelines', author: 'vercel-labs', stars: 316538 },
  { id: 'microsoft-foundry', name: 'microsoft-foundry', author: 'microsoft', stars: 314400 },
  { id: 'remotion-best-practices', name: 'remotion-best-practices', author: 'remotion-dev', stars: 307100 },
  { id: 'azure-messaging', name: 'azure-messaging', author: 'microsoft', stars: 302100 },
  { id: 'azure-hosted-copilot-sdk', name: 'azure-hosted-copilot-sdk', author: 'microsoft', stars: 285600 },
  { id: 'agent-browser', name: 'agent-browser', author: 'vercel-labs', stars: 268564 },
  { id: 'azure-compute', name: 'azure-compute', author: 'microsoft', stars: 256500 },
  { id: 'azure-cloud-migrate', name: 'azure-cloud-migrate', author: 'microsoft', stars: 246800 },
  { id: 'azure-cost-optimization', name: 'azure-cost-optimization', author: 'microsoft', stars: 205200 },
  { id: 'skill-creator', name: 'skill-creator', author: 'anthropics', stars: 204400 },
  { id: 'azure-quotas', name: 'azure-quotas', author: 'microsoft', stars: 184000 },
  { id: 'azure-upgrade', name: 'azure-upgrade', author: 'microsoft', stars: 176600 },
  { id: 'vercel-composition-patterns', name: 'vercel-composition-patterns', author: 'vercel-labs', stars: 172067 },
  { id: 'supabase-postgres-best-practices', name: 'supabase-postgres-best-practices', author: 'supabase', stars: 163029 },
  { id: 'agent-tools', name: 'agent-tools', author: 'inference-sh-skills', stars: 146659 },
  { id: 'sleek-design-mobile-apps', name: 'sleek-design-mobile-apps', author: 'sleekdotdesign', stars: 118856 },
  { id: 'vercel-react-native-skills', name: 'vercel-react-native-skills', author: 'vercel-labs', stars: 116107 },
  { id: 'extract-design-system', name: 'extract-design-system', author: 'arvindrk', stars: 93717 },
  { id: 'requesting-code-review', name: 'requesting-code-review', author: 'obra', stars: 82339 },
  { id: 'caveman-review', name: 'caveman-review', author: 'juliusbrussee', stars: 70632 },
  { id: 'subagent-driven-development', name: 'subagent-driven-development', author: 'obra', stars: 69697 },
  { id: 'supabase', name: 'supabase', author: 'supabase', stars: 66286 },
  { id: 'receiving-code-review', name: 'receiving-code-review', author: 'obra', stars: 65171 },
  { id: 'gpt-image-2', name: 'gpt-image-2', author: 'agentspace-so', stars: 59844 },
  { id: 'video-edit', name: 'video-edit', author: 'agentspace-so', stars: 59135 },
  { id: 'image-to-video', name: 'image-to-video', author: 'agentspace-so', stars: 58866 },
  { id: 'nano-banana-2', name: 'nano-banana-2', author: 'agentspace-so', stars: 58636 },
  { id: 'image-edit', name: 'image-edit', author: 'agentspace-so', stars: 58625 },
  { id: 'agentspace', name: 'agentspace', author: 'agentspace-so', stars: 56459 },
  { id: 'design-taste-frontend', name: 'design-taste-frontend', author: 'leonxlnx', stars: 53480 },
  { id: 'canvas-design', name: 'canvas-design', author: 'anthropics', stars: 53024 },
  { id: 'firebase-basics', name: 'firebase-basics', author: 'firebase', stars: 52253 },
  { id: 'firebase-auth-basics', name: 'firebase-auth-basics', author: 'firebase', stars: 51815 },
  { id: 'firebase-hosting-basics', name: 'firebase-hosting-basics', author: 'firebase', stars: 50486 },
  { id: 'firebase-app-hosting-basics', name: 'firebase-app-hosting-basics', author: 'firebase', stars: 50249 },
  { id: 'deploy-to-vercel', name: 'deploy-to-vercel', author: 'vercel-labs', stars: 49740 },
  { id: 'high-end-visual-design', name: 'high-end-visual-design', author: 'leonxlnx', stars: 46997 },
  { id: 'redesign-existing-projects', name: 'redesign-existing-projects', author: 'leonxlnx', stars: 46046 },
  { id: 'convex-quickstart', name: 'convex-quickstart', author: 'get-convex', stars: 45732 },
  { id: 'convex-performance-audit', name: 'convex-performance-audit', author: 'get-convex', stars: 45252 },
  { id: 'convex-setup-auth', name: 'convex-setup-auth', author: 'get-convex', stars: 45127 },
  { id: 'convex-migration-helper', name: 'convex-migration-helper', author: 'get-convex', stars: 45067 },
  { id: 'convex-create-component', name: 'convex-create-component', author: 'get-convex', stars: 45056 },
  { id: 'emil-design-eng', name: 'emil-design-eng', author: 'emilkowalski', stars: 44138 },
  { id: 'design-md', name: 'design-md', author: 'google-labs-code', stars: 43471 },
  { id: 'tailwind-design-system', name: 'tailwind-design-system', author: 'wshobson', stars: 41367 },
  { id: 'stitch-design-taste', name: 'stitch-design-taste', author: 'leonxlnx', stars: 39878 },
];

const MOCK_TRENDING: MarketplaceSkill[] = [
  { id: 'find-skills', name: 'find-skills', author: 'vercel-labs', stars: 19200 },
  { id: 'ai-image-generation', name: 'ai-image-generation', author: 'inference-sh-skills', stars: 12200 },
  { id: 'wonda-cli', name: 'wonda-cli', author: 'degausai', stars: 8700 },
  { id: 'soultrace', name: 'soultrace', author: 'soultrace-ai', stars: 8400 },
  { id: 'grill-me', name: 'grill-me', author: 'mattpocock', stars: 7500 },
  { id: 'lark-shared', name: 'lark-shared', author: 'larksuite', stars: 5100 },
  { id: 'frontend-design', name: 'frontend-design', author: 'anthropics', stars: 4900 },
  { id: 'flux-kontext', name: 'flux-kontext', author: 'agentspace-so', stars: 4900 },
  { id: 'agent-browser', name: 'agent-browser', author: 'vercel-labs', stars: 4700 },
  { id: 'kling-3-0', name: 'kling-3-0', author: 'agentspace-so', stars: 4700 },
  { id: 'happyhorse-1-0', name: 'happyhorse-1-0', author: 'agentspace-so', stars: 4700 },
  { id: 'caveman', name: 'caveman', author: 'juliusbrussee', stars: 4600 },
  { id: 'agentspace', name: 'agentspace', author: 'agentspace-so', stars: 4300 },
  { id: 'gpt-image-2', name: 'gpt-image-2', author: 'agentspace-so', stars: 4300 },
  { id: 'lark-approval', name: 'lark-approval', author: 'open.feishu.cn', stars: 3900 },
  { id: 'caveman-commit', name: 'caveman-commit', author: 'juliusbrussee', stars: 3700 },
  { id: 'microsoft-foundry', name: 'microsoft-foundry', author: 'microsoft', stars: 3600 },
  { id: 'sleek-design-mobile-apps', name: 'sleek-design-mobile-apps', author: 'sleekdotdesign', stars: 3400 },
  { id: 'airunway-aks-setup', name: 'airunway-aks-setup', author: 'microsoft', stars: 3400 },
  { id: 'lark-vc-agent', name: 'lark-vc-agent', author: 'open.feishu.cn', stars: 3400 },
  { id: 'entra-agent-id', name: 'entra-agent-id', author: 'microsoft', stars: 3300 },
  { id: 'lark-markdown', name: 'lark-markdown', author: 'open.feishu.cn', stars: 3300 },
  { id: 'lark-okr', name: 'lark-okr', author: 'open.feishu.cn', stars: 3300 },
  { id: 'impeccable', name: 'impeccable', author: 'pbakaus', stars: 3300 },
  { id: 'vercel-react-best-practices', name: 'vercel-react-best-practices', author: 'vercel-labs', stars: 3200 },
  { id: 'github-actions-docs', name: 'github-actions-docs', author: 'xixu-me', stars: 2800 },
  { id: 'skill-creator', name: 'skill-creator', author: 'anthropics', stars: 2800 },
  { id: 'use-my-browser', name: 'use-my-browser', author: 'xixu-me', stars: 2800 },
  { id: 'paper-context-resolver', name: 'paper-context-resolver', author: 'lllllllama', stars: 2800 },
  { id: 'readme-i18n', name: 'readme-i18n', author: 'xixu-me', stars: 2800 },
  { id: 'minimal-run-and-audit', name: 'minimal-run-and-audit', author: 'lllllllama', stars: 2700 },
  { id: 'xget', name: 'xget', author: 'xixu-me', stars: 2700 },
  { id: 'env-and-assets-bootstrap', name: 'env-and-assets-bootstrap', author: 'lllllllama', stars: 2700 },
  { id: 'repo-intake-and-plan', name: 'repo-intake-and-plan', author: 'lllllllama', stars: 2700 },
  { id: 'web-design-guidelines', name: 'web-design-guidelines', author: 'vercel-labs', stars: 2600 },
  { id: 'brainstorming', name: 'brainstorming', author: 'obra', stars: 2600 },
  { id: 'supabase-postgres-best-practices', name: 'supabase-postgres-best-practices', author: 'supabase', stars: 2500 },
  { id: 'ai-video-generation', name: 'ai-video-generation', author: 'agentspace-so', stars: 2500 },
  { id: 'remotion-best-practices', name: 'remotion-best-practices', author: 'remotion-dev', stars: 2300 },
  { id: 'ui-ux-pro-max', name: 'ui-ux-pro-max', author: 'nextlevelbuilder', stars: 2100 },
  { id: 'supabase', name: 'supabase', author: 'supabase', stars: 2000 },
  { id: 'simple', name: 'simple', author: 'roin-orca', stars: 1900 },
  { id: 'shadcn', name: 'shadcn', author: 'shadcn', stars: 1900 },
  { id: 'brand-landingpage', name: 'brand-landingpage', author: 'wshobson', stars: 1800 },
  { id: 'hyperframes', name: 'hyperframes', author: 'heygen-com', stars: 1800 },
  { id: 'pptx', name: 'pptx', author: 'anthropics', stars: 1700 },
  { id: 'emil-design-eng', name: 'emil-design-eng', author: 'emilkowalski', stars: 1700 },
  { id: 'using-superpowers', name: 'using-superpowers', author: 'obra', stars: 1700 },
  { id: 'writing-plans', name: 'writing-plans', author: 'obra', stars: 1700 },
  { id: 'hyperframes-cli', name: 'hyperframes-cli', author: 'heygen-com', stars: 1700 },
];

const MOCK_HOT: MarketplaceSkill[] = [
  { id: 'lark-vc-agent', name: 'lark-vc-agent', author: 'open.feishu.cn', stars: 659, change: 351 },
  { id: 'lark-im', name: 'lark-im', author: 'larksuite', stars: 785, change: 329 },
  { id: 'ai-video-generation', name: 'ai-video-generation', author: 'agentspace-so', stars: 212, change: 212 },
  { id: 'replicas-agent', name: 'replicas-agent', author: 'replicas-group', stars: 151, change: 131 },
  { id: 'agent-browser', name: 'agent-browser', author: 'vercel-labs', stars: 323, change: 119 },
  { id: 'nia', name: 'nia', author: 'nozomio-labs', stars: 115, change: 105 },
  { id: 'make-interfaces-feel-better', name: 'make-interfaces-feel-better', author: 'jakubkrehel', stars: 111, change: 100 },
  { id: 'opentui', name: 'opentui', author: 'msmps', stars: 107, change: 97 },
  { id: 'emil-design-eng', name: 'emil-design-eng', author: 'emilkowalski', stars: 128, change: 74 },
  { id: 'image-edit', name: 'image-edit', author: 'agentspace-so', stars: 223, change: 43 },
  { id: 'gws-gmail-forward', name: 'gws-gmail-forward', author: 'googleskills-managers', stars: 42, change: 37 },
  { id: 'gws-drive', name: 'gws-drive', author: 'googleskills-managers', stars: 50, change: 36 },
  { id: 'gpt-image-edit', name: 'gpt-image-edit', author: 'agentspace-so', stars: 224, change: 35 },
  { id: 'gws-docs', name: 'gws-docs', author: 'googleskills-managers', stars: 51, change: 35 },
  { id: 'agentspace', name: 'agentspace', author: 'agentspace-so', stars: 210, change: 32 },
  { id: 'gws-calendar', name: 'gws-calendar', author: 'googleskills-managers', stars: 48, change: 32 },
  { id: 'codex-pet', name: 'codex-pet', author: 'agentspace-so', stars: 224, change: 30 },
  { id: 'recipe-email-drive-link', name: 'recipe-email-drive-link', author: 'googleskills-managers', stars: 37, change: 30 },
  { id: 'persona-content-creator', name: 'persona-content-creator', author: 'googleskills-managers', stars: 37, change: 30 },
  { id: 'nano-banana-edit', name: 'nano-banana-edit', author: 'agentspace-so', stars: 217, change: 28 },
  { id: 'notion-cli', name: 'notion-cli', author: 'makenotion', stars: 28, change: 26 },
  { id: 'pdf-extraction', name: 'pdf-extraction', author: 'claude-office-skills', stars: 28, change: 22 },
  { id: 'three', name: 'three', author: 'heygen-com', stars: 92, change: 20 },
  { id: 'deep-research', name: 'deep-research', author: 'claude-office-skills', stars: 22, change: 19 },
  { id: 'company-research', name: 'company-research', author: 'claude-office-skills', stars: 22, change: 19 },
  { id: 'gsap', name: 'gsap', author: 'heygen-com', stars: 90, change: 18 },
  { id: 'wecomcli-msg', name: 'wecomcli-msg', author: 'wecomteam', stars: 27, change: 18 },
  { id: 'weekly-report', name: 'weekly-report', author: 'claude-office-skills', stars: 21, change: 18 },
  { id: 'academic-search', name: 'academic-search', author: 'claude-office-skills', stars: 21, change: 18 },
  { id: 'typegpu', name: 'typegpu', author: 'heygen-com', stars: 87, change: 17 },
  { id: 'contribute-catalog', name: 'contribute-catalog', author: 'heygen-com', stars: 85, change: 17 },
  { id: 'wecomcli-doc', name: 'wecomcli-doc', author: 'wecomteam', stars: 26, change: 17 },
  { id: 'security-monitoring', name: 'security-monitoring', author: 'claude-office-skills', stars: 20, change: 17 },
  { id: 'relight', name: 'relight', author: 'agentspace-so', stars: 17, change: 17 },
  { id: 'lottie', name: 'lottie', author: 'heygen-com', stars: 90, change: 16 },
  { id: 'hyperframes-media', name: 'hyperframes-media', author: 'heygen-com', stars: 89, change: 16 },
  { id: 'animejs', name: 'animejs', author: 'heygen-com', stars: 87, change: 16 },
  { id: 'whatsapp-automation', name: 'whatsapp-automation', author: 'claude-office-skills', stars: 21, change: 16 },
  { id: 'brainstorming', name: 'brainstorming', author: 'obra', stars: 156, change: 15 },
  { id: 'hyperframes-cli', name: 'hyperframes-cli', author: 'heygen-com', stars: 91, change: 15 },
  { id: 'website-to-hyperframes', name: 'website-to-hyperframes', author: 'heygen-com', stars: 89, change: 15 },
  { id: 'tailwind', name: 'tailwind', author: 'heygen-com', stars: 89, change: 15 },
  { id: 'smart-ocr', name: 'smart-ocr', author: 'claude-office-skills', stars: 22, change: 15 },
  { id: 'remotion-best-practices', name: 'remotion-best-practices', author: 'remotion-dev', stars: 78, change: 14 },
  { id: 'firebase-auth-basics', name: 'firebase-auth-basics', author: 'firebase', stars: 49, change: 14 },
  { id: 'firebase-ai-logic-basics', name: 'firebase-ai-logic-basics', author: 'firebase', stars: 48, change: 14 },
  { id: 'wrangler', name: 'wrangler', author: 'cloudflare', stars: 22, change: 14 },
  { id: 'home-assistant-automation', name: 'home-assistant-automation', author: 'claude-office-skills', stars: 20, change: 14 },
  { id: 'hyperframes-registry', name: 'hyperframes-registry', author: 'heygen-com', stars: 86, change: 13 },
  { id: 'firebase-basics', name: 'firebase-basics', author: 'firebase', stars: 48, change: 13 },
];

const MOCK_DATA: Record<SourceType, MarketplaceSkill[]> = {
  allTime: MOCK_ALL_TIME,
  trending: MOCK_TRENDING,
  hot: MOCK_HOT,
};

// ─── 详情面板（引导下载桌面版）──────────────────────────────────────────────────

function SkillDetailDrawer({ skill, onClose }: { skill: MarketplaceSkill; onClose: () => void }) {
  const installCmd = `npx skills add ${skill.author}/${skill.id} --skill ${skill.id}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-bg-card">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors z-10"
      >
        <Icon name="close" className="text-gray-600 dark:text-gray-300" />
      </button>

      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-dark-border">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate pr-8">{skill.name}</h2>
        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-gray-400">
          <Icon name="person" className="text-xs flex-shrink-0" />
          <span>{skill.author}</span>
          {skill.stars != null && (
            <>
              <span className="mx-1">·</span>
              <Icon name="download" className="text-xs flex-shrink-0" />
              <span>{skill.stars.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* 主体：下载引导 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#b71422]/10 flex items-center justify-center">
          <Icon name="download_for_offline" style={{ fontSize: '32px' }} className="text-[#b71422]" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">安装技能需要桌面版</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed max-w-xs">
            技能安装通过本地 Git 写入文件系统，无法在浏览器中完成。
          </p>
        </div>
        <a
          href="https://github.com/cchao123/skills-managers/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#b71422] hover:bg-[#8f0f1a] text-white font-bold text-sm transition-colors shadow-sm"
        >
          <Icon name="download" className="text-lg" />
          下载桌面版
        </a>
        <button
          onClick={() => window.open(`https://skills.sh/${skill.author}/${skill.id}`, '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-[#b71422] dark:hover:text-[#fca5a5] transition-colors"
        >
          <Icon name="open_in_new" className="text-sm" />
          在 skills.sh 查看
        </button>
      </div>

      {/* Footer：安装命令 */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-dark-border">
        <p className="text-[11px] text-slate-400 dark:text-gray-500 mb-2">或通过命令行安装：</p>
        <div className="flex items-center gap-2 bg-[#f3f4f5] dark:bg-dark-bg-tertiary rounded-lg pl-3 pr-2 py-2">
          <span className="font-mono text-xs text-slate-700 dark:text-gray-300 break-all flex-1 select-all">{installCmd}</span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 rounded hover:bg-[#e1e3e4] dark:hover:bg-dark-hover transition-colors"
            title="复制"
          >
            <Icon name={copied ? 'check' : 'content_copy'} className={`text-sm ${copied ? 'text-green-500' : 'text-slate-500 dark:text-gray-400'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function SkillDownloadPreview() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('allTime');
  const [detailSkill, setDetailSkill] = useState<MarketplaceSkill | null>(null);
  const [isTableScrolled, setIsTableScrolled] = useState(false);

  const filteredSkills = useMemo(() => {
    const base = MOCK_DATA[sourceType];
    if (!searchTerm) return base;
    const q = searchTerm.toLowerCase();
    return base.filter((s) => s.name.toLowerCase().includes(q) || s.author.toLowerCase().includes(q));
  }, [sourceType, searchTerm]);

  const isHot = sourceType === 'hot';
  const isPanelOpen = !!detailSkill;
  const showActionText = !isPanelOpen;

  return (
    <ResizableDetailLayout
      isPanelOpen={isPanelOpen}
      panel={() => detailSkill ? (
        <SkillDetailDrawer skill={detailSkill} onClose={() => setDetailSkill(null)} />
      ) : null}
    >
      <div className="flex flex-col flex-1 min-h-0 bg-[#f8f9fa] dark:bg-dark-bg-secondary">
        {/* 顶部栏 */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4" data-tauri-drag-region>
          <div className="flex items-center gap-3 h-11">
            {/* Tab */}
            <div className="relative grid grid-cols-3 items-center rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-slate-100 dark:bg-dark-bg-tertiary p-0.5 h-9 shrink-0">
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
                  <button
                    key={tab.id}
                    onClick={() => setSourceType(tab.id)}
                    aria-pressed={isActive}
                    className="relative z-10 flex items-center justify-center w-full h-full gap-1.5 px-3 rounded-md transition-colors"
                  >
                    <Icon name={tab.icon} className={`text-lg transition-colors ${isActive ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`} />
                    <span className={`text-xs font-bold whitespace-nowrap transition-colors ${isActive ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}>
                      {t(tab.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 搜索框 */}
            <div className="flex-1 relative">
              <div className={`flex items-center h-9 rounded-lg border bg-white dark:bg-dark-bg-card overflow-hidden transition-all ${searchTerm ? 'border-[#b71422]/40' : 'border-[#e1e3e4] dark:border-dark-border focus-within:border-[#b71422]'}`}>
                <Icon name="search" className="flex-shrink-0 text-slate-400 dark:text-gray-400 ml-3" />
                <input
                  type="text"
                  placeholder={t('skillDownload.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 h-full w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 pl-2 pr-3"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-dark-bg-tertiary"
                  >
                    <Icon name="close" className="text-sm text-slate-400 dark:text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 min-h-0 flex overflow-hidden px-5 pb-5">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            {filteredSkills.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Icon name="extension" className="text-6xl text-slate-300 dark:text-gray-600 mb-4" />
                <p className="text-slate-600 dark:text-gray-400">{t('skillDownload.notFound')}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-[#e1e3e4] dark:border-dark-border flex flex-col flex-1 min-h-0 overflow-hidden">
                <div
                  className="overflow-x-auto overflow-y-auto flex-1 min-h-0"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setIsTableScrolled(el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth);
                  }}
                >
                  <table className="w-full min-w-[600px]">
                    <colgroup>
                      <col className="w-14" />
                      <col />
                      <col className="w-44" />
                      <col className="w-32" />
                      <col className={showActionText ? 'w-32' : 'w-14'} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-[#f9fafb] dark:bg-dark-bg-tertiary shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">{t('skillDownload.column.skill')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">{t('skillDownload.column.author')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border">
                          {isHot ? t('skillDownload.column.installs1hChange') : t('skillDownload.column.installs')}
                        </th>
                        <th className={`sticky right-0 ${showActionText ? 'px-4' : 'px-2'} py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 border-b border-[#e1e3e4] dark:border-dark-border bg-[#f9fafb] dark:bg-dark-bg-tertiary ${isTableScrolled ? 'shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''} transition-shadow duration-200`}>
                          {t('skillDownload.column.action')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e1e3e4] dark:divide-dark-border">
                      {filteredSkills.map((skill, index) => {
                        const isSelected = detailSkill?.id === skill.id;
                        const cellBg = isSelected ? 'bg-red-50 dark:bg-red-900/20' : '';
                        const actionBg = isSelected ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-dark-bg-card';
                        return (
                          <tr
                            key={`${skill.id}-${skill.author}`}
                            className="hover:bg-[#fafbfb] dark:hover:bg-dark-hover transition-colors cursor-pointer"
                            onClick={() => setDetailSkill(isSelected ? null : skill)}
                          >
                            <td className={`px-4 py-3 align-middle text-sm font-bold text-slate-500 dark:text-gray-400 ${cellBg}`}>#{index + 1}</td>
                            <td className={`px-4 py-3 align-middle ${cellBg}`}>
                              <span className="text-sm font-bold text-slate-900 dark:text-white">{skill.name}</span>
                            </td>
                            <td className={`px-4 py-3 align-middle ${cellBg}`}>
                              <span className="text-xs font-bold text-slate-600 dark:text-gray-300">{skill.author}</span>
                            </td>
                            <td className={`px-4 py-3 align-middle whitespace-nowrap ${cellBg}`}>
                              {skill.stars != null ? (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Icon name="download" className="text-sm text-slate-400 dark:text-gray-500" />
                                  <span className="font-bold text-[#191c1d] dark:text-white">{skill.stars.toLocaleString()}</span>
                                  {isHot && skill.change != null && (
                                    <span className={`font-bold tabular-nums ${skill.change > 0 ? 'text-green-600 dark:text-green-400' : skill.change < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                                      {skill.change > 0 ? '+' : ''}{skill.change}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-xs text-slate-400 dark:text-gray-500">—</span>}
                            </td>
                            <td className={`sticky right-0 ${showActionText ? 'px-4' : 'px-2'} py-3 align-middle ${actionBg} ${isTableScrolled ? 'shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]' : ''} transition-shadow duration-200`}>
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailSkill(isSelected ? null : skill); }}
                                  className={`h-8 rounded-md font-bold text-xs bg-[#b71422] text-white hover:bg-[#8f0f1a] transition-all duration-300 flex items-center justify-center gap-1 ${showActionText ? 'w-28 px-2' : 'w-8'}`}
                                >
                                  <Icon name="download" className="text-sm" />
                                  {showActionText && <span className="truncate">{t('skillDownload.download')}</span>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* 数据来源 */}
                <div className="flex-shrink-0 px-4 py-2 border-t border-[#e1e3e4] dark:border-dark-border flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-gray-500">
                  <span>由于跨域限制，当前展示 mock 数据，来源</span>
                  <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="hover:text-[#b71422] dark:hover:text-[#fca5a5] transition-colors">skills.sh</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ResizableDetailLayout>
  );
}
