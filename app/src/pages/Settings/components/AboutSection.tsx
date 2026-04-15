import { useTranslation } from 'react-i18next';
import { GITHUB_URLS } from '../constants/config';

const DOCS_BASE_URL = `${GITHUB_URLS.REPO}/blob/main/docs`;

export const AboutSection: React.FC = () => {
  const { t, i18n } = useTranslation();

  const docsUrl = i18n.language === 'zh'
    ? `${DOCS_BASE_URL}/user-guide.md`
    : `${DOCS_BASE_URL}/user-guide-en.md`;

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-8 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#b71422] to-[#a01220] flex items-center justify-center mb-6 shadow-lg">
          <span className="material-symbols-outlined text-5xl text-white">settings</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          {t('app.name')}
        </h2>
        <p className="text-lg text-slate-600 dark:text-gray-300 mb-6">
          {t('app.version')}
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-[#b71422] to-[#a01220] rounded-full mb-6"></div>
        <div className="text-sm text-slate-600 dark:text-gray-300 space-y-2 max-w-md">
          <p className="text-slate-700 dark:text-white font-medium">
            {t('settings.aboutDescription')}
          </p>
          <p className="mt-4">
            {t('settings.builtWith')}{' '}
            <span className="text-[#b71422] font-bold">Tauri 2</span> + <span className="text-[#b71422] font-bold">React</span>
          </p>
        </div>
        <div className="mt-8 flex gap-4">
          <a
            href={GITHUB_URLS.HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-[#b71422] hover:bg-[#a01220] text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
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
