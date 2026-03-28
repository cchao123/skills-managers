import React from 'react';
import { useTranslation } from 'react-i18next';
import { Collapse } from '../../../components/Collapse';

export const ConfigGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Collapse
      maxHeight="600px"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-800 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.67-.3-5.46-1.334-5.46-5.925 0-1.305.465-2.38 1.23-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.005-.322 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.297-1.23 3.297-1.23.66 1.653.242 2.874.118 3.176.77.84 1.235 1.905 1.235 3.22 0 4.605-2.805 5.624-5.475 5.921.43.372.823 1.102.823 2.22 0 1.605-.015 2.89-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('githubBackup.guide.title')}</h2>
        </div>
      }
    >
      <div className="flex gap-4 py-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">1</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.guide.step1.title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300">
            {t('githubBackup.guide.step1.description')}{' '}
            <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-[#b71422] hover:underline font-medium">
              {t('githubBackup.guide.step1.link')} →
            </a>
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">2</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.guide.step2.title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300">
            {t('githubBackup.guide.step2.description')}{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-[#b71422] hover:underline font-medium">
              {t('githubBackup.guide.step2.link')} →
            </a>
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">3</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.guide.step3.title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('githubBackup.guide.step3.description')}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-sm">4</div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('githubBackup.guide.step4.title')}</h3>
          <p className="text-sm text-slate-600 dark:text-gray-300">{t('githubBackup.guide.step4.description')}</p>
        </div>
      </div>

      <div className="mt-5 bg-[#20c997] dark:bg-teal-700/30 rounded-xl p-4 flex gap-4">
        <span className="material-symbols-outlined text-white text-2xl flex-shrink-0">info</span>
        <div>
          <p className="text-white text-sm font-medium leading-relaxed">
            {t('githubBackup.guide.notice')}
          </p>
        </div>
      </div>
    </Collapse>
  );
};
