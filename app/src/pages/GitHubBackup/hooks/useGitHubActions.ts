import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import { githubApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { STAR_REPO_OWNER, STAR_REPO_NAME, STAR_REPO_URL } from '../constants/config';

export const useGitHubActions = (repoConfig: any, setConnected?: (connected: boolean) => void, onSaveConfig?: () => void | Promise<void>) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [starred, setStarred] = useState(false);
  const [starring, setStarring] = useState(false);

  const handleTestConnection = useCallback(async () => {
    if (!repoConfig.owner || !repoConfig.repo || !repoConfig.token) {
      showToast('warning', t('githubBackup.messages.fillRequired'));
      return;
    }

    try {
      setTesting(true);
      await githubApi.testConnection({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        branch: repoConfig.branch,
        token: repoConfig.token,
      });
      showToast('success', t('githubBackup.messages.connectionSuccess'));
      setConnected?.(true);
      // Auto-save config after successful connection test
      if (onSaveConfig) {
        await onSaveConfig();
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      const errMsg = typeof error === 'string' ? error : (error as Error)?.message || t('githubBackup.messages.connectionFailed');
      showToast('error', errMsg);
      throw error;
    } finally {
      setTesting(false);
    }
  }, [repoConfig, showToast, setConnected, onSaveConfig]);

  const handleSync = useCallback(async (hasDefaultRepo: boolean, overwriteRemote = false) => {
    if (!hasDefaultRepo) {
      showToast('warning', t('githubBackup.messages.saveFirst'));
      return;
    }

    try {
      setSyncing(true);
      await githubApi.syncRepo('default', repoConfig.branch, { overwriteRemote });
      showToast('success', `${t('githubBackup.messages.syncSuccess')}\nhttps://github.com/${repoConfig.owner}/${repoConfig.repo}`);
    } catch (error: any) {
      console.error('Sync failed:', error);
      showToast('error', `${t('githubBackup.messages.syncFailed')}: ${error?.message || error}`);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [repoConfig, showToast, t]);

  const handleRestore = useCallback(async (hasDefaultRepo: boolean, overwriteLocal = false) => {
    if (!hasDefaultRepo) {
      showToast('warning', t('githubBackup.messages.saveFirst'));
      return;
    }

    try {
      setRestoring(true);
      const count = await githubApi.restoreFromGithub('default', overwriteLocal);
      if (count > 0) {
        showToast('success', t('githubBackup.messages.restoreSuccess').replace('{count}', String(count)));
      } else {
        showToast('warning', t('githubBackup.messages.restoreEmpty'));
      }
    } catch (error: any) {
      console.error('Restore failed:', error);
      showToast('error', `${t('githubBackup.messages.restoreFailed')}: ${error?.message || error}`);
      throw error;
    } finally {
      setRestoring(false);
    }
  }, [showToast, t]);

  const handleStar = useCallback(async () => {
    if (starred || starring) return;

    if (!repoConfig.token) {
      open(STAR_REPO_URL);
      return;
    }

    setStarring(true);
    try {
      const ok = await githubApi.starRepo(STAR_REPO_OWNER, STAR_REPO_NAME, repoConfig.token);
      if (ok) {
        setStarred(true);
        showToast('success', 'Star 成功！感谢支持 ⭐');
      } else {
        showToast('error', 'Star 失败，正在打开 GitHub 页面...');
        open(STAR_REPO_URL);
      }
    } catch (error) {
      const errMsg = typeof error === 'string' ? error : (error as Error)?.message || 'Star 失败';
      showToast('error', errMsg);
      open(STAR_REPO_URL);
    } finally {
      setStarring(false);
    }
  }, [repoConfig.token, starred, starring, showToast]);

  return {
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
  };
};
