import { agentNeedsInvertInDark, getAgentIconUrl } from '@/constants/agents';

/**
 * Get agent icon SVG path
 */
export const getAgentIcon = (name: string): string => getAgentIconUrl(name);

/**
 * Check if agent needs color inversion in dark mode
 */
export const needsInvertInDark = (agentName: string): boolean =>
  agentNeedsInvertInDark(agentName);
