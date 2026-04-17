import { useMemo } from 'react';
import type { SkillMetadata, MergedSkillInfo, SourcePathInfo } from '@/types';
import { SOURCE_GLOBAL } from '@/pages/Dashboard/utils/source';

export interface MergedView {
  allSources: string[];
  nativeAgents: Set<string>;
  allPaths: SourcePathInfo[];
}

/**
 * 统一计算"合并卡片视图"所需的派生值。
 * 当 `merged` 存在时直接使用合并后的结果；否则根据单个 skill 回退构造。
 */
export function useMergedView(skill: SkillMetadata, merged?: MergedSkillInfo): MergedView {
  return useMemo(() => {
    const source = skill.source ?? SOURCE_GLOBAL;
    const isNative = skill.source && skill.source !== SOURCE_GLOBAL;

    return {
      allSources: merged?.allSources ?? [source],
      nativeAgents: merged?.nativeAgents ?? new Set<string>(isNative ? [skill.source as string] : []),
      allPaths: merged?.allPaths ?? (skill.path ? [{ source, path: skill.path }] : []),
    };
  }, [skill, merged]);
}
