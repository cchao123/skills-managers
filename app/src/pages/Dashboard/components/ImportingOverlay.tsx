import { useTranslation } from 'react-i18next';

export const ImportingOverlay: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-dark-bg-card rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-slate-200 dark:border-dark-bg-tertiary border-t-[#b71422]"></div>
        <p className="text-sm font-bold text-slate-700 dark:text-gray-300">{t('dashboard.importing')}</p>
      </div>
    </div>
  );
};
