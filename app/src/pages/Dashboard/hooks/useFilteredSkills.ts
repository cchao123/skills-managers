import { useMemo } from 'react';
import type { SkillMetadata } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';

/**
 * 根据选中的来源和置顶状态过滤技能
 */
export function useFilteredSkills(
  filteredSkills: SkillMetadata[],
  selectedSource: string,
  pinnedIds: Set<string>
) {
  // 按来源展示过滤：Schema v2 中一条 skill 可能分布在多个源里，
  // 只要 `sources` 包含当前选中源就展示。下游组件按 `selectedSource` 定位当前 tab。
  // 排序：pinned 优先（保持其它过滤后的相对顺序）。
  return useMemo(() => {
    // All 或空字符串: 显示所有技能
    if (!selectedSource || selectedSource === SOURCE.All) {
      return [...filteredSkills].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 0 : 1;
        const bp = pinnedIds.has(b.id) ? 0 : 1;
        return ap - bp;
      });
    }
    // 其他来源：只显示包含该来源的技能
    const list = filteredSkills.filter(skill => (skill.sources ?? []).includes(selectedSource));
    return [...list].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1;
      const bp = pinnedIds.has(b.id) ? 0 : 1;
      return ap - bp;
    });
  }, [filteredSkills, selectedSource, pinnedIds]);
}
