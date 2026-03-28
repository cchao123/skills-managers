import claudeIcon from '../../../assets/agents/claude.svg';
import cursorIcon from '../../../assets/agents/cursor.svg';
import gptIcon from '../../../assets/agents/GPT.svg';
import openclawIcon from '../../../assets/agents/openclaw.svg';

// Agent icon mapping
export const AGENT_ICONS: Record<string, string> = {
  'claude': claudeIcon,
  'cursor': cursorIcon,
  'gpt': gptIcon,
  'codex': gptIcon,
  'openclaw': openclawIcon,
};

// Agents that need color inversion in dark mode
export const NEEDS_INVERT_IN_DARK = new Set(['gpt', 'codex']);

// Fallback icon for unknown agents
export const DEFAULT_AGENT_ICON = openclawIcon;
