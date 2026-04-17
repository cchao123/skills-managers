import { useState, useMemo, useCallback } from 'react';
import type { SkillMetadata } from '@/types';
import { SESSION_STORAGE_KEYS } from '@/constants';
import { FILTER_TYPE, type FilterType } from '@/pages/Dashboard/constants/filterType';
import { matchesAnyPrefix, useSkillHidePrefixes } from '@/hooks/useSkillHidePrefixes';

export const useSkillFilters = (skills: SkillMetadata[]) => {
  const [searchTerm, setSearchTermRaw] = useState(
    () => sessionStorage.getItem(SESSION_STORAGE_KEYS.dashboardSearchTerm) ?? ''
  );
  const [filterType, setFilterType] = useState<FilterType>(FILTER_TYPE.All);
  const { prefixes: hidePrefixes } = useSkillHidePrefixes();

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermRaw(value);
    try {
      if (value) {
        sessionStorage.setItem(SESSION_STORAGE_KEYS.dashboardSearchTerm, value);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.dashboardSearchTerm);
      }
    } catch { /* ignore */ }
  }, []);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // 用户自定义前缀屏蔽（例如 lark-*）：按 id 匹配
      if (matchesAnyPrefix(skill.id, hidePrefixes)) return false;

      const matchesSearch = searchTerm === '' ||
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterType === FILTER_TYPE.All ||
        (filterType === FILTER_TYPE.Enabled && skill.enabled) ||
        (filterType === FILTER_TYPE.Disabled && !skill.enabled);

      return matchesSearch && matchesFilter;
    });
  }, [skills, searchTerm, filterType, hidePrefixes]);

  return {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filteredSkills,
  };
};
