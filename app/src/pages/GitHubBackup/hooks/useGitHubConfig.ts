import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { githubApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { isTauri } from '@/lib/tauri-env';
import { DEFAULT_REPO_CONFIG } from '../constants/config';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

type MockConfig = {
  repositories: {
    [key: string]: {
      owner: string;
      repo: string;
      branch: string;
      last_sync: string;
      token?: string;
    };
  };
};

export const useGitHubConfig = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [config, setConfig] = useState<any>({ repositories: {} });
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [repoConfig, setRepoConfig] = useState<RepoConfig>(DEFAULT_REPO_CONFIG);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);

  // Mock data for development
  const mockConfig: MockConfig = {
    repositories: {
      'custom-skills': {
        owner: 'username',
        repo: 'custom-skills',
        branch: 'main',
        last_sync: '2024-03-29T10:30:00Z'
      }
    }
  };

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      if (!isTauri()) {
        if (import.meta.env.DEV) console.log('Running in browser, using mock config');
        setUseMock(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const repos = Object.values(mockConfig.repositories);
        if (repos.length > 0) {
          const firstRepo = repos[0];
          setRepoConfig({
            owner: firstRepo.owner,
            repo: firstRepo.repo,
            branch: firstRepo.branch,
            token: '',
          });
        }

        setConfig(mockConfig);
        setLoading(false);
        return;
      }

      const data = await githubApi.getConfig();
      setConfig(data);

      const repos = Object.values(data.repositories);
      if (repos.length > 0) {
        const firstRepo = repos[0];
        setRepoConfig({
          owner: firstRepo.owner,
          repo: firstRepo.repo,
          branch: firstRepo.branch,
          token: firstRepo.token || '',
        });
      }

      // 从 localStorage 恢复连接状态
      const savedConnectionState = localStorage.getItem('github_connected');
      const wasConnected = savedConnectionState === 'true';
      setConnected(wasConnected);
    } catch (error) {
      console.error('Failed to load GitHub config:', error);
      showToast('error', t('common.error'));
      setUseMock(true);
      setConfig(mockConfig);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(async (newConfig: RepoConfig) => {
    if (!newConfig.owner || !newConfig.repo || !newConfig.token) return;

    setSaving(true);

    if (useMock || !isTauri()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setConfig((prev: { repositories: Record<string, unknown> }) => ({
        ...prev,
        repositories: {
          ...prev.repositories,
          'default': {
            owner: newConfig.owner,
            repo: newConfig.repo,
            branch: newConfig.branch,
            token: newConfig.token || undefined,
          }
        }
      }));
      setSaving(false);
      return;
    }

    await githubApi.saveConfig({
      owner: newConfig.owner,
      repo: newConfig.repo,
      branch: newConfig.branch,
      token: newConfig.token || undefined,
    });
    setConfig((prev: { repositories: Record<string, unknown> }) => ({
      ...prev,
      repositories: {
        ...prev.repositories,
        'default': {
          owner: newConfig.owner,
          repo: newConfig.repo,
          branch: newConfig.branch,
          token: newConfig.token || undefined,
        }
      }
    }));
    setSaving(false);
  }, [useMock]);

  const updateField = useCallback((field: keyof RepoConfig, value: string) => {
    // 只更新内存中的表单状态，不自动写盘。
    // 写盘仅发生在"测试连接"成功之后（见 useGitHubActions.handleTestConnection），
    // 这样可以保证磁盘上的配置 === 最近一次验证通过的配置，
    // 避免用户填错信息后关闭应用，再打开时凭残留配置触发同步/恢复。
    const newConfig = { ...repoConfig, [field]: value };
    setRepoConfig(newConfig);
    // 如果用户修改了任何配置字段，清除连接状态，需要重新测试连接
    if (connected) {
      setConnected(false);
      localStorage.removeItem('github_connected');
    }
  }, [repoConfig, connected]);

  return {
    config,
    repoConfig,
    loading,
    useMock,
    connected,
    setConnected,
    loadConfig,
    updateField,
    setRepoConfig,
    triggerAutoSave,
  };
};
