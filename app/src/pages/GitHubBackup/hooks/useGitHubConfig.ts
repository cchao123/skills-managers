import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { githubApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { isTauri } from '@/lib/tauri-env';
import { AUTO_SAVE_DELAY, DEFAULT_REPO_CONFIG } from '../constants/config';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}

type MockConfig = {
  repositories: {
    [key: string]: {
      owner: string;
      repo: string;
      branch: string;
      path: string;
      enabled: boolean;
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
        path: 'skills',
        enabled: true,
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
            path: firstRepo.path.startsWith('/') ? firstRepo.path : `/${firstRepo.path}`,
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
          path: firstRepo.path.startsWith('/') ? firstRepo.path : `/${firstRepo.path}`,
          token: firstRepo.token || '',
        });
        // Has config with token, mark as connected
        if (firstRepo.token) {
          setConnected(true);
        }
      }
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
            path: newConfig.path.startsWith('/') ? newConfig.path.slice(1) : newConfig.path,
            enabled: true,
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
      path: newConfig.path.startsWith('/') ? newConfig.path.slice(1) : newConfig.path,
      token: newConfig.token || undefined,
    });
    // Update local config state after successful save
    setConfig((prev: { repositories: Record<string, unknown> }) => ({
      ...prev,
      repositories: {
        ...prev.repositories,
        'default': {
          owner: newConfig.owner,
          repo: newConfig.repo,
          branch: newConfig.branch,
          path: newConfig.path.startsWith('/') ? newConfig.path.slice(1) : newConfig.path,
          enabled: true,
          token: newConfig.token || undefined,
        }
      }
    }));
    setSaving(false);
  }, [useMock]);

  // Debounced auto-save
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const updateField = useCallback((field: keyof RepoConfig, value: string) => {
    const newConfig = { ...repoConfig, [field]: value };
    setRepoConfig(newConfig);
    if (connected) setConnected(false);

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (!newConfig.owner || !newConfig.repo || !newConfig.token) return;

    autoSaveTimer = setTimeout(async () => {
      await triggerAutoSave(newConfig);
    }, AUTO_SAVE_DELAY);
  }, [repoConfig, connected, triggerAutoSave]);

  return {
    config,
    repoConfig,
    loading,
    useMock,
    saving,
    connected,
    setConnected,
    loadConfig,
    updateField,
    setRepoConfig,
    triggerAutoSave,
  };
};
