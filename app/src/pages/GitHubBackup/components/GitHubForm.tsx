import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RepoConfig } from '../hooks/useGitHubConfig';

interface GitHubFormProps {
  config: RepoConfig;
  connected: boolean;
  onChange: (field: keyof RepoConfig, value: string) => void;
  onEditClick?: () => void;
}

export const GitHubForm = ({
  config,
  connected,
  onChange,
  onEditClick,
}: GitHubFormProps) => {
  const { t } = useTranslation();
  const [showToken, setShowToken] = React.useState(false);

  return (
    <div className="space-y-6" style={{ marginTop: '1.5rem' }}>
      <div className="relative">
        {connected && (
          <div
            className="absolute inset-0 z-10 cursor-pointer rounded-xl"
            onClick={onEditClick}
            title={t('githubBackup.form.connectedTitle')}
          />
        )}
        <div className="space-y-6">
          {/* Repository (Owner / Repo) + Branch */}
          <div className="flex items-start gap-4">
            <div className="w-[60%] min-w-0">
              <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">
                {t('githubBackup.config.owner')} / {t('githubBackup.config.repo')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.owner}
                  onChange={(e) => onChange('owner', e.target.value)}
                  disabled={connected}
                  placeholder={t('githubBackup.config.ownerPlaceholder')}
                  className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-lg text-slate-400 dark:text-gray-500 font-light select-none shrink-0">/</span>
                <input
                  type="text"
                  value={config.repo}
                  onChange={(e) => onChange('repo', e.target.value)}
                  disabled={connected}
                  placeholder={t('githubBackup.config.repoPlaceholder')}
                  className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">{t('githubBackup.config.ownerHelper')}</p>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">
                {t('githubBackup.config.branch')}
              </label>
              <input
                type="text"
                value={config.branch}
                onChange={(e) => onChange('branch', e.target.value)}
                disabled={connected}
                placeholder={t('githubBackup.config.branchPlaceholder')}
                className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">{t('githubBackup.config.branchHelper')}</p>
            </div>
          </div>
        </div>

        {/* Personal Access Token */}
        <div className="mt-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">
            {t('githubBackup.config.token')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.token}
              onChange={(e) => onChange('token', e.target.value)}
              disabled={connected}
              placeholder={t('githubBackup.config.tokenPlaceholder')}
              className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl px-4 py-3 pr-12 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {!connected && (
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">
                  {showToken ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            )}
          </div>
          {!connected && (
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5">
              {t('githubBackup.config.tokenHelperBefore')}
              <a
                href="https://github.com/settings/personal-access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Personal access tokens
              </a>
              {t('githubBackup.config.tokenHelperAfter')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
