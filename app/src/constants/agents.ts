import claudeIcon from '@/assets/agents/claude.svg';
import cursorIcon from '@/assets/agents/cursor.svg';
import gptIcon from '@/assets/agents/GPT.svg';
import openclawIcon from '@/assets/agents/openclaw.svg';
import opencodeIcon from '@/assets/agents/opencode.svg';
import traeIcon from '@/assets/agents/trae.svg';
import qoderIcon from '@/assets/agents/qoder.svg';
import antigravityIcon from '@/assets/agents/antigravity.svg';
import kiroIcon from '@/assets/agents/kiro.svg';

/**
 * 前端维护的 agent 元信息 —— 单一数据源。
 *
 * 新增/调整 agent 时只改动这里，所有依赖（Settings 列表、Dashboard 路径、
 * Detail Modal 全名、Source 短名、图标）都会自动同步。
 *
 * 字段说明：
 * - `name`         : agent 的机读名，与后端 SkillSource / agent key 一致。
 * - `shortName`    : 用于 badge / tab 等狭窄位置的简短名称。
 * - `displayName`  : 用于卡片/详情的完整名称，可能包含品牌后缀（如 "Claude Code"）。
 * - `rootPath`     : 用户主目录下的根目录，打开文件夹时使用。
 * - `icon`         : agent 图标资源（svg import 后的 URL）。
 * - `invertInDark` : 深色模式下是否需要反色（白图反成黑图）。
 */
interface AgentMeta {
  name: string;
  shortName: string;
  displayName: string;
  rootPath: string;
  icon: string;
  invertInDark?: boolean;
}

const AGENT_META = {
  claude: {
    name: 'claude',
    shortName: 'Claude',
    displayName: 'Claude Code',
    rootPath: '~/.claude',
    icon: claudeIcon,
  },
  cursor: {
    name: 'cursor',
    shortName: 'Cursor',
    displayName: 'Cursor',
    rootPath: '~/.cursor',
    icon: cursorIcon,
  },
  codex: {
    name: 'codex',
    shortName: 'Codex',
    displayName: 'Codex',
    rootPath: '~/.codex',
    icon: gptIcon,
    invertInDark: true,
  },
  openclaw: {
    name: 'openclaw',
    shortName: 'OpenClaw',
    displayName: 'OpenClaw',
    rootPath: '~/.openclaw',
    icon: openclawIcon,
  },
  opencode: {
    name: 'opencode',
    shortName: 'OpenCode',
    displayName: 'OpenCode',
    rootPath: '~/.opencode',
    icon: opencodeIcon,
  },
  trae: {
    name: 'trae',
    shortName: 'Trae',
    displayName: 'Trae',
    rootPath: '~/.trae',
    icon: traeIcon,
  },
  qoder: {
    name: 'qoder',
    shortName: 'Qoder',
    displayName: 'Qoder',
    rootPath: '~/.qoder',
    icon: qoderIcon,
  },
  antigravity: {
    name: 'antigravity',
    shortName: 'Antigravity',
    displayName: 'Antigravity',
    rootPath: '~/.antigravity',
    icon: antigravityIcon,
  },
  kiro: {
    name: 'kiro',
    shortName: 'Kiro',
    displayName: 'Kiro',
    rootPath: '~/.kiro',
    icon: kiroIcon,
  },
} as const satisfies Record<string, AgentMeta>;

/** 按声明顺序列出的 agent 列表，可用于渲染 Settings/Dashboard 列表 */
export const KNOWN_AGENTS: readonly AgentMeta[] = Object.values(AGENT_META);

/** 未知 agent 图标的兜底资源 */
const DEFAULT_AGENT_ICON = openclawIcon;

const getMeta = (name: string): AgentMeta | undefined =>
  (AGENT_META as Record<string, AgentMeta>)[name];

export const getAgentRootPath = (name: string): string =>
  getMeta(name)?.rootPath ?? '';

export const getAgentDisplayName = (name: string): string =>
  getMeta(name)?.displayName ?? name;

export const getAgentShortName = (name: string): string =>
  getMeta(name)?.shortName ?? name;

export const getAgentIconUrl = (name: string): string =>
  getMeta(name)?.icon ?? DEFAULT_AGENT_ICON;

export const agentNeedsInvertInDark = (name: string): boolean =>
  getMeta(name)?.invertInDark === true;
