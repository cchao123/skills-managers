import { useState, useMemo } from 'react';
import type { SkillMetadata } from '../../../types';

type FilterType = 'all' | 'enabled' | 'disabled';

export const useSkillFilters = (skills: SkillMetadata[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesSearch = searchTerm === '' ||
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterType === 'all' ||
        (filterType === 'enabled' && skill.enabled) ||
        (filterType === 'disabled' && !skill.enabled);

      return matchesSearch && matchesFilter;
    });
  }, [skills, searchTerm, filterType]);

  return {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filteredSkills,
  };
};
