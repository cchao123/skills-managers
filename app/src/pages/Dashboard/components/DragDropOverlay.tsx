import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { SOURCE, sourceDisplayName } from '@/pages/Dashboard/utils/source';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';

interface DragDropOverlayProps {
  selectedSource?: string;
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ selectedSource }) => {
  const { t } = useTranslation();

  const isAgent = selectedSource && selectedSource !== SOURCE.All && selectedSource !== SOURCE.Global;
  const icon = isAgent ? getAgentIcon(selectedSource) : null;
  const label = isAgent ? sourceDisplayName(selectedSource) : 'Root (~/.skills-manager)';

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[99999] pointer-events-none">
      <div className="flex flex-col items-center gap-3 bg-white/95 dark:bg-gray-800/95 px-4 py-6 rounded-xl shadow-2xl">
        <Icon name="drive_folder_upload" className="text-[#b71422] text-6xl" />
        <div className="flex items-center gap-2">
          <p className="text-2xl font-black text-gray-800 dark:text-white tracking-wide">{t('dashboard.dragDrop.release')}到</p>
          {icon ? (
            <img src={icon} alt={label} className={`w-5 h-5 object-contain ${needsInvertInDark(selectedSource!) ? 'dark:invert' : ''}`} />
          ) : (
            <img src={OCTOPUS_LOGO_URL} alt="Root" className="w-5 h-5" />
          )}
          <p className="text-2xl font-black text-[#b71422] tracking-wide">{label}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.dragDrop.hint')}</p>
      </div>
    </div>
  );
};
