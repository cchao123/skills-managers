import { useTranslation } from 'react-i18next';

interface ActionButtonsProps {
  connected: boolean;
  testing: boolean;
  restoring: boolean;
  syncing: boolean;
  onTest: () => void;
  onEdit: () => void;
  onRestore: () => void;
  onSync: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  connected,
  testing,
  restoring,
  syncing,
  onTest,
  onEdit,
  onRestore,
  onSync,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex gap-4 pt-4">
      {!connected ? (
        <button
          onClick={onTest}
          disabled={testing}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-[#adb5bd] hover:bg-[#999] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">
            {testing ? 'hourglass_top' : 'link'}
          </span>
          {testing ? t('githubBackup.buttons.testing') : t('githubBackup.buttons.testConnection')}
        </button>
      ) : (
        <button
          onClick={onEdit}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-[#adb5bd] hover:bg-[#999] text-white transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          {t('githubBackup.buttons.editConfig')}
        </button>
      )}
      <button
        onClick={onRestore}
        disabled={restoring || syncing}
        className="px-6 py-3 rounded-xl text-sm font-bold bg-white dark:bg-dark-bg-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-slate-700 dark:text-white border border-[#e1e3e4] dark:border-dark-border transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span className={`material-symbols-outlined text-lg ${restoring ? 'animate-spin' : ''}`}>
          cloud_download
        </span>
        {restoring ? t('githubBackup.buttons.restoring') : t('githubBackup.buttons.restoreNow')}
      </button>
      <button
        onClick={onSync}
        disabled={syncing || restoring}
        className="px-6 py-3 rounded-xl text-sm font-bold bg-[#b71422] hover:bg-[#a01220] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>
          cloud_upload
        </span>
        {syncing ? t('githubBackup.buttons.syncing') : t('githubBackup.buttons.syncNow')}
      </button>
    </div>
  );
};
