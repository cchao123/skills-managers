import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

interface DashboardFloatingActionsProps {
  helpButtonRef: React.RefObject<HTMLButtonElement>;
  onHelpClick: () => void;
  logButtonRef: React.RefObject<HTMLButtonElement>;
  onLogClick: () => void;
  isDrawerOpen?: boolean;
  isScrolling?: boolean;
}

export const DashboardFloatingActions: React.FC<DashboardFloatingActionsProps> = memo(({
  helpButtonRef,
  onHelpClick,
  logButtonRef,
  onLogClick,
  isDrawerOpen = false,
  isScrolling = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`fixed bottom-6 right-6 flex flex-col gap-2 z-[200] transition-transform duration-300 ${(isDrawerOpen || isScrolling) ? 'translate-x-[calc(100%+1.5rem)]' : ''}`}>
      <div className="relative group">
        <button
          ref={helpButtonRef}
          onClick={onHelpClick}
          className="w-9 h-9 rounded-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all"
        >
          <Icon name="help" className="text-base text-slate-500 dark:text-gray-400" />
        </button>
        <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:block">
          <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
            {t('dashboard.viewHelp')}
          </div>
        </div>
      </div>
      <div className="relative group">
        <button
          ref={logButtonRef}
          onClick={onLogClick}
          className="w-9 h-9 rounded-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all"
        >
          <Icon name="history" className="text-base text-slate-500 dark:text-gray-400" />
        </button>
        <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none hidden group-hover:block">
          <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg">
            {t('dashboard.operationLog.title')}
          </div>
        </div>
      </div>
    </div>
  );
});
