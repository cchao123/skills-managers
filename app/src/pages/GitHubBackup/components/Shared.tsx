import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapse } from '@/components/Collapse';

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={copied ? t('githubBackup.shared.copied') : t('githubBackup.shared.copy')}
    >
      <span className="material-symbols-outlined text-base text-gray-500 dark:text-gray-400">
        {copied ? 'check' : 'content_copy'}
      </span>
    </button>
  );
}

export const Shared: React.FC<{ owner: string; repo: string }> = ({ owner, repo }) => {
  const { t } = useTranslation();
  const marketplacePath = owner && repo ? `${owner}/${repo}` : 'owner/repo';

  return (
    <Collapse
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-800 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.67-.3-5.46-1.334-5.46-5.925 0-1.305.465-2.38 1.23-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.005-.322 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.297-1.23 3.297-1.23.66 1.653.242 2.874.118 3.176.77.84 1.235 1.905 1.235 3.22 0 4.605-2.805 5.624-5.475 5.921.43.372.823 1.102.823 2.22 0 1.605-.015 2.89-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('githubBackup.shared.title')}</h2>
        </div>
      }
    >

      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-[#b71422]">terminal</span>
        {t('githubBackup.shared.claudeCode')}
        <span className="text-xs font-normal text-slate-400 dark:text-gray-500">{t('githubBackup.shared.viaMarketplace')}</span>
      </h3>

      <div className="flex gap-3 py-4">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-xs">1</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.shared.step1Title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-2">{t('githubBackup.shared.step1Desc')}</p>
          <div className="relative">
            <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 pr-9 text-sm font-mono text-[#b71422]">/plugin marketplace add {marketplacePath}</code>
            <CopyButton text={`/plugin marketplace add ${marketplacePath}`} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-xs">2</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.shared.step2Title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-2">{t('githubBackup.shared.step2Desc')}</p>
          <div className="relative">
            <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 pr-9 text-sm font-mono text-[#b71422]">/plugin install {'<skill-name>'}@{marketplacePath}</code>
            <CopyButton text={`/plugin install <skill-name>@${marketplacePath}`} />
          </div>
        </div>
      </div>

      {/* https://cursor.com/cn/docs/skills#github  转化成点mdc效果不好 */}
      
      {/* <h3 className="pt-8 text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-[#b71422]">terminal</span>
        {t('githubBackup.shared.cursor')}
        <span className="text-xs font-normal text-slate-400 dark:text-gray-500">{t('githubBackup.shared.viaRemoteRule')}</span>
      </h3>

      <div className="flex gap-4 py-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">1</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.shared.cursorStep1Title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('githubBackup.shared.cursorStep1Desc')}</p>
        </div>
      </div>

      <div className="flex gap-4 py-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">2</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.shared.cursorStep2Title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-2">{t('githubBackup.shared.cursorStep2Desc')}</p>
          <div className="relative">
            <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 pr-9 text-sm font-mono text-[#b71422] break-all">https://github.com/{marketplacePath}</code>
            <CopyButton text={`https://github.com/${marketplacePath}`} />
          </div>
        </div>
      </div> */}
    </Collapse>
  );
};
