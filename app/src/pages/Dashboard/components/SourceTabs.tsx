import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import { getAgentIcon } from '@/pages/Dashboard/utils/agentHelpers';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { SOURCE_TAB_ICON_ONLY_THRESHOLD } from '@/pages/Dashboard/constants/panel';
import { useDetectedAgents } from '@/pages/Dashboard/hooks/useDetectedAgents';

interface TabItem {
  id: string;
  label: string;
  icon: string;
}

interface SourceTabsProps {
  agents: AgentConfig[];
  selectedSource: string;
  onSelect: (source: string) => void;
}

export const SourceTabs: React.FC<SourceTabsProps> = ({ agents, selectedSource, onSelect }) => {
  const { t } = useTranslation();
  const detectedAgents = useDetectedAgents(agents);

  const tabs = useMemo<TabItem[]>(() => [
    { id: SOURCE.Global, label: t('dashboard.source.global'), icon: '/octopus-logo.png' },
    ...detectedAgents.map(a => ({
      id: a.name,
      label: a.display_name,
      icon: getAgentIcon(a.name),
    })),
  ], [detectedAgents, t]);

  const iconOnly = tabs.length > SOURCE_TAB_ICON_ONLY_THRESHOLD;

  return (
    <div className="flex flex-wrap items-center gap-2 h-[50px]">
      {tabs.map(item => {
        const isSelected = selectedSource === item.id;
        const showLabel = !iconOnly || isSelected;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={iconOnly && !isSelected ? item.label : undefined}
            className={`flex items-center gap-1.5 ${showLabel ? 'px-3' : 'px-2.5'} py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              isSelected
                ? 'bg-[#b71422] text-white font-bold'
                : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <img src={item.icon} alt={item.label} className="w-full h-full object-contain" />
            </div>
            {showLabel && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
