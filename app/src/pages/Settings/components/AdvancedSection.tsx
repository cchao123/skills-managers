import { useTranslation } from 'react-i18next';

interface AdvancedSectionProps {
  advancedMode: boolean;
  onToggle: (value: boolean) => void;
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  advancedMode,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl p-6 shadow-sm border border-[#e1e3e4] dark:border-dark-border">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl text-slate-600 dark:text-gray-300">build</span>
          {t('settings.advanced.title')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          {t('settings.advanced.description')}
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#e1e3e4] dark:border-dark-border bg-[#fafafa] dark:bg-dark-bg-secondary">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-gray-200">
              {t('settings.advanced.modeLabel')}
            </span>
            {advancedMode && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                ON
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
            {advancedMode
              ? t('settings.advanced.enabledHint')
              : t('settings.advanced.disabledHint')}
          </p>
        </div>
        <button
          onClick={() => onToggle(!advancedMode)}
          className={`relative w-10 h-[22px] rounded-full transition-all flex-shrink-0 mt-0.5 ${
            advancedMode ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform ${
              advancedMode ? 'translate-x-[18px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {advancedMode && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {t('settings.advanced.warning')}
          </p>
        </div>
      )}
    </div>
  );
};
