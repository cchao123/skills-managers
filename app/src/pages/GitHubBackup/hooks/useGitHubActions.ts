import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { githubApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { TelemetryEvent, WINDOW_EVENTS } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';

/** 通知 Dashboard 静默刷新 skills 列表（sync/restore 成功后）。 */
const emitSkillsRefresh = () => {
  window.dispatchEvent(new CustomEvent(WINDOW_EVENTS.skillsRefresh));
};

// 辅助函数：检测是否是认证错误
const isAuthError = (errorMsg: string): boolean => {
  const authErrorPatterns = [
    /401/,
    /403/,
    /unauthorized/i,
    /authentication/i,
    /token.*invalid/i,
    /token.*expired/i,
    /credentials/i,
    /认证/,
    /token.*无效/,
    /token.*过期/,
  ];
  return authErrorPatterns.some(pattern => pattern.test(errorMsg));
};

export const useGitHubActions = (repoConfig: any, setConnected?: (connected: boolean) => void, onSaveConfig?: () => void | Promise<void>) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);

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

      // 保存连接状态到 localStorage
      localStorage.setItem('github_connected', 'true');

      // 追踪测试连接事件
      trackEvent(TelemetryEvent.GITHUB_TEST_LINK_CLICKED, {
        repo: `${repoConfig.owner}/${repoConfig.repo}`,
        branch: repoConfig.branch || 'main'
      });

      // Auto-save config after successful connection test
      if (onSaveConfig) {
        await onSaveConfig();
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      // 测试连接失败时，清除 localStorage 中的连接状态
      localStorage.removeItem('github_connected');
      setConnected?.(false);

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

      // 追踪同步事件
      trackEvent(TelemetryEvent.GITHUB_SYNC_CLICKED, {
        repo: `${repoConfig.owner}/${repoConfig.repo}`,
        branch: repoConfig.branch || 'main',
        overwrite_remote: overwriteRemote ? 'true' : 'false'
      });

      showToast('success', `${t('githubBackup.messages.syncSuccess')}\nhttps://github.com/${repoConfig.owner}/${repoConfig.repo}`);
      emitSkillsRefresh();
    } catch (error: any) {
      console.error('Sync failed:', error);
      const errMsg = error?.message || error;

      // 检查是否是认证错误，如果是则清除连接状态
      if (isAuthError(errMsg)) {
        localStorage.removeItem('github_connected');
        setConnected?.(false);
      }

      showToast('error', `${t('githubBackup.messages.syncFailed')}: ${errMsg}`);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [repoConfig, showToast, t, setConnected]);

  const handleRestore = useCallback(async (hasDefaultRepo: boolean, overwriteLocal = false) => {
    if (!hasDefaultRepo) {
      showToast('warning', t('githubBackup.messages.saveFirst'));
      return;
    }

    try {
      setRestoring(true);
      const count = await githubApi.restoreFromGithub('default', overwriteLocal);

      // 追踪恢复事件
      trackEvent(TelemetryEvent.GITHUB_RESTORE_CLICKED, {
        repo: 'default',
        overwrite_local: overwriteLocal ? 'true' : 'false',
        restored_count: count
      });

      if (count > 0) {
        showToast('success', t('githubBackup.messages.restoreSuccess').replace('{count}', String(count)));
      } else {
        showToast('warning', t('githubBackup.messages.restoreEmpty'));
      }
      if (count > 0) emitSkillsRefresh();
    } catch (error: any) {
      console.error('Restore failed:', error);
      const errMsg = error?.message || error;

      // 检查是否是认证错误，如果是则清除连接状态
      if (isAuthError(errMsg)) {
        localStorage.removeItem('github_connected');
        setConnected?.(false);
      }

      showToast('error', `${t('githubBackup.messages.restoreFailed')}: ${errMsg}`);
      throw error;
    } finally {
      setRestoring(false);
    }
  }, [showToast, t, setConnected]);

  return {
    testing,
    syncing,
    restoring,
    handleTestConnection,
    handleSync,
    handleRestore,
  };
};
