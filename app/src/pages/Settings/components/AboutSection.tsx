import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import { GITHUB_URLS } from '../constants/config';
import { useVersionCheck } from '../hooks/useVersionCheck';

const DOCS_BASE_URL = `${GITHUB_URLS.REPO}/blob/main/docs`;

export const AboutSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    current,
    latest,
    status,
    error,
    releaseUrl,
    checkNow,
  } = useVersionCheck();

  const docsUrl = i18n.language === 'zh'
    ? `${DOCS_BASE_URL}/user-guide.md`
    : `${DOCS_BASE_URL}/user-guide-en.md`;
  const aboutHighlights = [
    {
      title: t('settings.aboutHighlights.visualSchedulingTitle'),
      description: t('settings.aboutHighlights.visualSchedulingDescription'),
    },
    {
      title: t('settings.aboutHighlights.cleanReuseTitle'),
      description: t('settings.aboutHighlights.cleanReuseDescription'),
    },
    {
      title: t('settings.aboutHighlights.oneClickHubTitle'),
      description: t('settings.aboutHighlights.oneClickHubDescription'),
    },
  ];

  const withV = (v: string) => (v.startsWith('v') ? v : `v${v}`);
  const displayCurrent = withV(current);
  const displayLatest = latest ? withV(latest) : '--';

  let statusLabel: string;
  let statusTone: string;
  switch (status) {
    case 'checking':
      statusLabel = t('settings.version.checking');
      statusTone = 'text-slate-500 dark:text-gray-400';
      break;
    case 'update-available':
      statusLabel = t('settings.version.updateAvailable');
      statusTone = 'text-[#b71422] dark:text-red-400';
      break;
    case 'up-to-date':
      statusLabel = t('settings.version.upToDate');
      statusTone = 'text-emerald-600 dark:text-emerald-400';
      break;
    case 'no-release':
      statusLabel = t('settings.version.noRelease');
      statusTone = 'text-slate-500 dark:text-gray-400';
      break;
    case 'error':
      statusLabel = t('settings.version.checkFailed');
      statusTone = 'text-amber-600 dark:text-amber-400';
      break;
    default:
      statusLabel = t('settings.version.unknown');
      statusTone = 'text-slate-500 dark:text-gray-400';
  }

  const checking = status === 'checking';

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-8 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#fff] to-[#f0f0f0] flex items-center justify-center mb-6 shadow-lg">
          <img src="/octopus-logo.png" alt="Octopus Logo" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          {t('app.name')}
        </h2>

        {/* 版本区域 */}
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-gray-400">
              {t('settings.version.current')}
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {displayCurrent}
            </span>
            <span className="text-slate-300 dark:text-gray-600">·</span>
            <span className="text-slate-500 dark:text-gray-400">
              {t('settings.version.latest')}
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {displayLatest}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs">
            <span
              className={`font-semibold ${statusTone}`}
              title={status === 'error' && error ? error : undefined}
            >
              {statusLabel}
            </span>
            <button
              onClick={() => void checkNow()}
              disabled={checking}
              className="text-slate-500 dark:text-gray-400 hover:text-[#b71422] dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title={t('settings.version.recheck')}
            >
              <span className={`material-symbols-outlined text-sm ${checking ? 'animate-spin' : ''}`}>
                refresh
              </span>
              {t('settings.version.recheck')}
            </button>
          </div>

          {status === 'update-available' && releaseUrl && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => open(releaseUrl)}
                className="px-4 py-2 bg-[#b71422] hover:bg-[#a01220] text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">download</span>
                {t('settings.version.goDownload')}
              </button>
            </div>
          )}

          {(status === 'no-release' || status === 'error') && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => open(GITHUB_URLS.RELEASES)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-card text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                {t('settings.version.viewOnGithub')}
              </button>
            </div>
          )}
        </div>

        <div className="w-16 h-1 bg-gradient-to-r from-[#b71422] to-[#a01220] rounded-full mb-6"></div>
        <div className="text-sm text-slate-600 dark:text-gray-300 space-y-2">
          <ul className="list-disc pl-5 text-left space-y-2 marker:text-[#b71422] marker:font-bold">
            {aboutHighlights.map((item) => (
              <li key={item.title}>
                <span className="text-[#b71422] font-bold">{item.title}</span>：{item.description}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex gap-4">
          <a
            href={GITHUB_URLS.REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-[#b71422] hover:bg-[#a01220] text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg></span>
            GitHub
          </a>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-card text-slate-700 dark:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">description</span>
            Documentation
          </a>
        </div>
      </div>
    </div>
  );
};
