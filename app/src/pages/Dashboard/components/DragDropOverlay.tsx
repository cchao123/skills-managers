import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
export const DragDropOverlay: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[99999] pointer-events-none">
      <div className="flex flex-col items-center gap-3 bg-white/95 dark:bg-gray-800/95 px-8 py-6 rounded-xl shadow-2xl">
        <Icon name="drive_folder_upload" className="text-[#b71422] text-6xl" />
        <p className="text-2xl font-black text-gray-800 dark:text-white tracking-wide">{t('dashboard.dragDrop.release')}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('dashboard.dragDrop.hint')}</p>
      </div>
    </div>
  );
};
