import { useMemo } from 'react';
import type { SkillMetadata } from '@/types';
import { matchesAnyPrefix, useSkillHidePrefixes } from '@/hooks/useSkillHidePrefixes';

/**
 * 只应用前缀过滤。
 *
 * Schema v2 之后后端已经按 skill_id 聚合，每条记录唯一，这里不再需要
 * 按 id 去重 / 按 source 优先级排序。
 */
export const usePrefixFilteredSkills = (skills: SkillMetadata[]) => {
  const { prefixes: hidePrefixes } = useSkillHidePrefixes();

  return useMemo(
    () => skills.filter((skill) => !matchesAnyPrefix(skill.id, hidePrefixes)),
    [skills, hidePrefixes]
  );
};
