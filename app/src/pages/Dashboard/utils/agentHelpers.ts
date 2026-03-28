import { AGENT_ICONS, DEFAULT_AGENT_ICON, NEEDS_INVERT_IN_DARK } from '../constants/agentIcons';

/**
 * Get agent icon SVG path
 */
export const getAgentIcon = (name: string): string => {
  return AGENT_ICONS[name] || DEFAULT_AGENT_ICON;
};

/**
 * Check if agent needs color inversion in dark mode
 */
export const needsInvertInDark = (agentName: string): boolean => {
  return NEEDS_INVERT_IN_DARK.has(agentName);
};

/**
 * Get CSS classes for agent icon
 */
export const getAgentIconClasses = (agentName: string): string => {
  return needsInvertInDark(agentName) ? 'dark:invert' : '';
};
