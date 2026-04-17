import type { SkillSource } from '@/types';
import { getAgentShortName } from '@/constants';

/**
 * 技能来源枚举：
 * - Global: Skills Manager 根目录（`~/.skills-manager/skills`）
 * - Cursor: Cursor 原生目录
 * - Claude: Claude Code 原生目录
 * - OpenClaw: OpenClaw 原生目录
 * - Codex: Codex 原生目录
 *
 * 使用 `as const` 对象 + 派生类型，保持运行时零开销。
 */
export const SOURCE = {
  Global: 'global',
  Cursor: 'cursor',
  Claude: 'claude',
  OpenClaw: 'openclaw',
  Codex: 'codex',
} as const;

/** 与 `@/types` 中的 `SkillSource` 保持一致。 */
export type Source = typeof SOURCE[keyof typeof SOURCE];

/** @deprecated 保持向后兼容，新代码请使用 `SOURCE.Global`。 */
export const SOURCE_GLOBAL = SOURCE.Global;

export const SOURCE_BADGE_STYLES: Record<Source, string> = {
  [SOURCE.Global]: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  [SOURCE.Cursor]: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  [SOURCE.Claude]: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  [SOURCE.OpenClaw]: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  [SOURCE.Codex]: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export const sourceLabel = (s: string) => (s === SOURCE.Global ? 'Root' : s);

export const badgeClass = (src?: string) =>
  SOURCE_BADGE_STYLES[(src as Source) ?? SOURCE.Global] || SOURCE_BADGE_STYLES[SOURCE.Global];

/**
 * Toast / 描述性文案里使用的首字母大写简短展示名。
 * 非 Global 的展示名从 {@link AGENT_META} 派生，新增 agent 无需改这里。
 */
export const SOURCE_DISPLAY_NAME: Record<Source, string> = {
  [SOURCE.Global]: 'Root',
  [SOURCE.Cursor]: getAgentShortName(SOURCE.Cursor),
  [SOURCE.Claude]: getAgentShortName(SOURCE.Claude),
  [SOURCE.OpenClaw]: getAgentShortName(SOURCE.OpenClaw),
  [SOURCE.Codex]: getAgentShortName(SOURCE.Codex),
};

export const sourceDisplayName = (s?: string) =>
  SOURCE_DISPLAY_NAME[(s as Source) ?? SOURCE.Global] ?? s ?? SOURCE.Global;

export const isSource = (v: unknown): v is SkillSource =>
  v === SOURCE.Global
  || v === SOURCE.Cursor
  || v === SOURCE.Claude
  || v === SOURCE.OpenClaw
  || v === SOURCE.Codex;
