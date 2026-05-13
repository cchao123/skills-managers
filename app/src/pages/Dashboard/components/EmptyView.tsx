import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { FILTER_TYPE } from '@/pages/Dashboard/constants/filterType';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';

interface EmptyViewProps {
  message: string;
  searchTerm?: string;
  filterType?: string;
  selectedSource?: string;
}

type ChipColor = 'blue' | 'green' | 'red';

interface ChipItem {
  label: string;
  color: ChipColor;
  icon?: string;
  invertInDark?: boolean;
}

const DOT_COLORS: Record<ChipColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
};

const TEXT_COLORS: Record<ChipColor, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
};

export const EmptyView: React.FC<EmptyViewProps> = ({ message, searchTerm, filterType, selectedSource }) => {
  const { t } = useTranslation();

  const chips: ChipItem[] = [];

  if (selectedSource && selectedSource !== SOURCE.All) {
    const isGlobal = selectedSource === SOURCE.Global;
    chips.push({
      label: `${t('dashboard.emptyView.sourcePrefix')}${isGlobal ? t('dashboard.source.global') : selectedSource}`,
      color: 'blue',
      icon: isGlobal ? OCTOPUS_LOGO_URL : getAgentIcon(selectedSource),
      invertInDark: !isGlobal && needsInvertInDark(selectedSource),
    });
  }

  if (filterType && filterType !== FILTER_TYPE.All) {
    chips.push({
      label: `${t('dashboard.emptyView.statePrefix')}${filterType === FILTER_TYPE.Enabled ? t('dashboard.filter.enabled') : t('dashboard.filter.disabled')}`,
      color: filterType === FILTER_TYPE.Enabled ? 'green' : 'red',
    });
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
      <Icon name="search_off" className="text-6xl text-gray-300 dark:text-gray-600 mb-4" />
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center mb-3">
          {chips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 bg-white dark:bg-dark-bg-card shadow-sm border border-slate-100 dark:border-dark-border">
              {chip.icon ? (
                <img
                  src={chip.icon}
                  alt=""
                  className={`w-3.5 h-3.5 flex-shrink-0 object-contain ${chip.invertInDark ? 'dark:invert' : ''}`}
                />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[chip.color]}`} />
              )}
              <span className={`text-xs font-bold ${TEXT_COLORS[chip.color]}`}>{chip.label}</span>
            </span>
          ))}
        </div>
      )}
      <p className="text-slate-500 dark:text-gray-400 font-medium">
        {message}
      </p>
    </div>
  );
};
