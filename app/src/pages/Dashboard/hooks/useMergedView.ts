import { useMemo } from 'react';
import type { SkillMetadata, SourcePathInfo } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';

interface MergedView {
  allSources: string[];
  nativeAgents: Set<string>;
  allPaths: SourcePathInfo[];
}

/**
 * 从单条 `SkillMetadata` 派生多源视图：
 * - `allSources`：所有物理副本所在位置。
 * - `nativeAgents`：非 global 的副本对应的 Agent 集合（用于阻止关闭开关）。
 * - `allPaths`：每个 source 对应的物理路径列表，供 UI 展示/跳转。
 */
export function useMergedView(skill: SkillMetadata): MergedView {
  return useMemo(() => {
    const sources = skill.sources ?? [];
    const nativeAgents = new Set(sources.filter(s => s !== SOURCE.Global));
    const allPaths: SourcePathInfo[] = Object.entries(skill.source_paths ?? {}).map(
      ([source, path]) => ({ source, path }),
    );
    return { allSources: sources, nativeAgents, allPaths };
  }, [skill]);
}
