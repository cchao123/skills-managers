import { SKILL_ICON_POOL, SKILL_COLOR_POOL } from '@/pages/Dashboard/constants/skillIcons';

/**
 * Deterministic hash from string to index
 * Same skill always gets same icon/color
 */
const hashIndex = (str: string, poolSize: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % poolSize;
};

/**
 * Get skill icon based on skill ID
 */
export const getSkillIcon = (skillId: string): string => {
  return SKILL_ICON_POOL[hashIndex(skillId, SKILL_ICON_POOL.length)];
};

/**
 * Get skill color class based on skill ID
 */
export const getSkillColor = (skillId: string): string => {
  return SKILL_COLOR_POOL[hashIndex(skillId, SKILL_COLOR_POOL.length)];
};
