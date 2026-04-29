import { useTranslation } from 'react-i18next';
import { open as openUrl } from '@tauri-apps/plugin-shell';

import { Icon } from '@/components/Icon';
interface StatusBadgeProps {
  connected: boolean;
  repoConfig: {
    owner: string;
    repo: string;
  };
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ connected, repoConfig }) => {
  const { t } = useTranslation();
  const path = `${repoConfig.owner}/${repoConfig.repo}`;
  return (
    <>
      {connected && (
        <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          {t('githubBackup.messages.connectionSuccess')}
        </span>
      )}
      
      {connected && repoConfig.owner && repoConfig.repo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openUrl(`https://github.com/${path}`);
          }}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {path}
          <Icon name="open_in_new" className="text-[14px]" />
        </button>
      )}
    </>
  );
};
