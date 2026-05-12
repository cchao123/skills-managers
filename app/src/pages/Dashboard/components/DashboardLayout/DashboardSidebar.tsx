import React from 'react';
import type { AgentConfig, SkillMetadata } from '@/types';
import { SourceTabs } from '@/pages/Dashboard/components/SourceTabs';

interface DashboardSidebarProps {
  agents: AgentConfig[];
  selectedSource: string;
  onSourceSelect: (source: string) => void;
  filteredSkills: SkillMetadata[];
  displayedSkillCount: number;
  totalFilteredCount: number;
  searchTerm: string;
  filterType: string;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  agents,
  selectedSource,
  onSourceSelect,
  filteredSkills,
  displayedSkillCount,
  totalFilteredCount,
  searchTerm,
  filterType,
}) => {
  return (
    <SourceTabs
      agents={agents}
      selectedSource={selectedSource}
      onSelect={onSourceSelect}
      skills={filteredSkills}
      displayedSkillCount={displayedSkillCount}
      totalFilteredCount={totalFilteredCount}
      searchTerm={searchTerm}
      filterType={filterType}
    />
  );
};
