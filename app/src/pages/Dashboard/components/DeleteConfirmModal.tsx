import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SkillMetadata } from '@/types';
import { badgeClass, sourceLabel, SOURCE } from '@/pages/Dashboard/utils/source';

interface DeleteConfirmModalProps {
  target: SkillMetadata | null;
  allSourceSkills?: SkillMetadata[];
  advancedMode?: boolean;
  onConfirm: (selected: SkillMetadata[]) => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  target,
  allSourceSkills,
  advancedMode = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win');
  const norm = (p: string) => (isWindows ? p.replace(/\//g, '\\') : p);

  const items = allSourceSkills && allSourceSkills.length > 0 ? allSourceSkills : target ? [target] : [];
  const isMulti = items.length > 1;

  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initial = items
      .filter(s => s.source === SOURCE.Global || advancedMode)
      .map(s => `${s.source}:${s.id}`);
    setChecked(new Set(initial));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, allSourceSkills, advancedMode]);

  if (!target) return null;

  const toggleCheck = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = items.filter(s => checked.has(`${s.source}:${s.id}`));
    if (selected.length > 0) onConfirm(selected);
  };

  const hasSelection = checked.size > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white/95 dark:bg-dark-bg-card backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),0_18px_36px_-18px_rgba(0,0,0,0.3)] border border-white/50 dark:border-dark-border overflow-hidden flex flex-col items-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-red-500 text-4xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            error
          </span>
        </div>
        <h3 className="font-bold text-2xl text-slate-900 dark:text-white mb-2">{t('dashboard.delete.title')}</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed mb-3 px-4">
          {t('dashboard.delete.message', { name: target.name })}
        </p>

        <div className="w-full text-left mb-3 space-y-2">
          {isMulti && (
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-1 px-1">{t('dashboard.delete.selectSources')}</p>
          )}
          {items.map(s => {
            const key = `${s.source}:${s.id}`;
            const isChecked = checked.has(key);
            const isLocked = s.source !== SOURCE.Global && !advancedMode;
            return (
              <div key={key} className="relative group/del">
                <label
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                    isLocked
                      ? 'cursor-not-allowed opacity-50 border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary'
                      : isChecked
                        ? 'cursor-pointer border-red-300 dark:border-red-500/40 bg-red-50/60 dark:bg-red-900/15'
                        : 'cursor-pointer border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg-secondary hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isLocked}
                    onChange={() => !isLocked && toggleCheck(key)}
                    className={`w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 flex-shrink-0 disabled:opacity-40 ${!isMulti && !isLocked ? 'hidden' : ''}`}
                  />
                  <span className={`text-[10px] font-bold py-0.5 px-1.5 rounded flex-shrink-0 ${badgeClass(s.source)}`}>
                    {sourceLabel(s.source ?? SOURCE.Global)}
                  </span>
                  <span className={`text-xs font-mono truncate min-w-0 flex-1 ${isLocked ? 'text-slate-400 dark:text-gray-500' : 'text-red-500 dark:text-red-400'}`}>
                    {s.path ? norm(s.path) : s.id}
                  </span>
                </label>
                {isLocked && (
                  <div className="hidden group-hover/del:flex absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 pointer-events-none z-50 justify-center">
                    <div className="bg-white dark:bg-dark-bg-card border border-amber-200 dark:border-amber-500/30 rounded-lg shadow-lg p-2.5 flex gap-2 items-start">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                        <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-gray-300">{t('dashboard.delete.advancedRequired')}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 dark:text-gray-500 leading-relaxed mb-6 px-4">
          {t('dashboard.delete.description')}
        </p>
        <div className="w-full flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!hasSelection}
            className={`w-full py-3.5 font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] ${
              hasSelection
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 hover:brightness-110'
                : 'bg-red-300 dark:bg-red-800/50 text-white/70 cursor-not-allowed shadow-none'
            }`}
          >
            {t('dashboard.delete.confirm')}{isMulti && checked.size > 0 ? ` (${checked.size})` : ''}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-dark-bg-secondary transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
