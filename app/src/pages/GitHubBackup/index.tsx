import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { githubApi, agentsApi } from '@/api/tauri';
import { useGitHubConfig } from './hooks/useGitHubConfig';
import { useGitHubActions } from './hooks/useGitHubActions';
import { StarButton } from './components/StarButton';
import { GitHubForm } from './components/GitHubForm';
import { ActionButtons } from './components/ActionButtons';
import { ConfigGuide } from './components/ConfigGuide';
import { Shared } from './components/Shared';
import { StatusBadge } from './components/StatusBadge';
import { Collapse } from '@/components/Collapse';

function GitHubBackup() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const {
    config,
    repoConfig,
    loading,
    saving,
    connected,
    setConnected,
    loadConfig,
    updateField,
  } = useGitHubConfig();

  const {
    testing,
    syncing,
    restoring,
    starred,
    starring,
    handleTestConnection,
    handleSync,
    handleRestore,
    handleStar,
    setStarred,
  } = useGitHubActions(repoConfig, setConnected);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected && repoConfig.token) {
      // Check star status
      githubApi.checkStar('cchao123', 'skills-managers', repoConfig.token)
        .then(setStarred)
        .catch(() => { });
    }
  }, [connected, repoConfig.token]);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader icon="backup" title={t('header.githubBackup')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-dark-bg-tertiary border-t-[#b71422] mb-4"></div>
            <p className="text-slate-500 dark:text-gray-300 font-medium">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon="backup"
        title={t('header.githubBackup')}
        actions={
          <>
            {saving && (
              <span className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1.5">
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-200 dark:border-dark-bg-tertiary border-t-[#b71422]"></span>
                {t('githubBackup.buttons.saving')}
              </span>
            )}
            <StarButton
              starred={starred}
              starring={starring}
              hasToken={!!repoConfig.token}
              onStar={handleStar}
            />
            <button
              onClick={() => agentsApi.openFolder().catch(() => {})}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              title={t('githubBackup.buttons.openLocal')}
            >
              <span className="material-symbols-outlined text-lg text-slate-500 dark:text-gray-400">folder_open</span>
              <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
                {t('githubBackup.buttons.openLocal')}
              </span>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-dark-bg-secondary">
        <div className="p-8 space-y-6">
          {/* GitHub Repository Configuration Form */}
          <Collapse
            maxHeight="600px"
            defaultOpen={true}
            title={
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-800 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.38 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.905 1.235 3.22 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('githubBackup.config.title')}</h2>
                <StatusBadge connected={connected} repoConfig={repoConfig} />
              </div>
            }
          >
            <GitHubForm
              config={repoConfig}
              connected={connected}
              onChange={updateField}
              onEditClick={() => {
                showToast('info', t('githubBackup.messages.connectedHint'));
              }}
            />
            {/* Action Buttons */}
            <ActionButtons
              connected={connected}
              testing={testing}
              restoring={restoring}
              syncing={syncing}
              onTest={handleTestConnection}
              onEdit={() => setConnected(false)}
              onRestore={async (overwriteLocal) => {
                if (!connected) {
                  showToast('warning', t('githubBackup.messages.testFirst'));
                  return;
                }
                if (!config.repositories || !config.repositories['default']) {
                  showToast('warning', t('githubBackup.messages.saveFirst'));
                  return;
                }
                await handleRestore(!!config.repositories['default'], overwriteLocal);
              }}
              onSync={async (overwriteRemote) => {
                if (!connected) {
                  showToast('warning', t('githubBackup.messages.testFirst'));
                  return;
                }
                if (!config.repositories || !config.repositories['default']) {
                  showToast('warning', t('githubBackup.messages.saveFirst'));
                  return;
                }
                await handleSync(!!config.repositories['default'], overwriteRemote);
              }}
            />
          </Collapse>

          {/* Configuration Guide - Accordion */}
          <ConfigGuide />

          <Shared owner={repoConfig.owner} repo={repoConfig.repo} />
        </div>
      </div>
    </div>
  );
}

export default GitHubBackup;
