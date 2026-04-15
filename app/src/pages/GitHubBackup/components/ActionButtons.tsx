import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface ActionButtonsProps {
  connected: boolean;
  testing: boolean;
  restoring: boolean;
  syncing: boolean;
  onTest: () => void;
  onEdit: () => void;
  onRestore: (overwriteLocal: boolean) => void | Promise<void>;
  onSync: (overwriteRemote: boolean) => void | Promise<void>;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  connected,
  testing,
  restoring,
  syncing,
  onTest,
  onEdit,
  onRestore,
  onSync,
}) => {
  const { t } = useTranslation();
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [restoreMenuOpen, setRestoreMenuOpen] = useState(false);
  const [overwriteRemote, setOverwriteRemote] = useState(false);
  const [overwriteLocal, setOverwriteLocal] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const syncSplitRef = useRef<HTMLDivElement>(null);
  const restoreSplitRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  /** fixed 坐标，避免 Collapse 等父级 overflow:hidden 裁切下拉 */
  const [syncMenuFixed, setSyncMenuFixed] = useState<{ top: number; left: number; width: number } | null>(null);
  const [restoreMenuFixed, setRestoreMenuFixed] = useState<{ top: number; left: number; width: number } | null>(null);

  const calcMenuPosition = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(r.width));
    let left = r.right - width;
    left = Math.min(left, window.innerWidth - width - 8);
    left = Math.max(8, left);
    const estMenuH = 72;
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const placeAbove = spaceBelow < estMenuH && r.top > estMenuH + gap;
    const top = placeAbove ? r.top - estMenuH - gap : r.bottom + gap;
    return { top, left, width };
  };

  useLayoutEffect(() => {
    if (!syncMenuOpen) { setSyncMenuFixed(null); return; }
    const update = () => setSyncMenuFixed(calcMenuPosition(syncSplitRef));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [syncMenuOpen]);

  useLayoutEffect(() => {
    if (!restoreMenuOpen) { setRestoreMenuFixed(null); return; }
    const update = () => setRestoreMenuFixed(calcMenuPosition(restoreSplitRef));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [restoreMenuOpen]);

  useEffect(() => {
    if (!syncMenuOpen && !restoreMenuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (syncSplitRef.current?.contains(target) || restoreSplitRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setSyncMenuOpen(false);
      setRestoreMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [syncMenuOpen, restoreMenuOpen]);

  return (
    <div className="flex gap-4 pt-4">
      {!connected ? (
        <button
          onClick={onTest}
          disabled={testing}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-[#adb5bd] hover:bg-[#999] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">
            {testing ? 'hourglass_top' : 'link'}
          </span>
          {testing ? t('githubBackup.buttons.testing') : t('githubBackup.buttons.testConnection')}
        </button>
      ) : (
        <button
          onClick={onEdit}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-[#adb5bd] hover:bg-[#999] text-white transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          {t('githubBackup.buttons.editConfig')}
        </button>
      )}
      {/* Restore split button */}
      <div className="relative inline-flex" ref={restoreSplitRef}>
        <div className="inline-flex rounded-xl overflow-hidden shadow-sm border border-[#e1e3e4] dark:border-dark-border">
          <button
            type="button"
            onClick={() => {
              setRestoreMenuOpen(false);
              if (overwriteLocal) {
                setShowRestoreConfirm(true);
              } else {
                void onRestore(false);
              }
            }}
            disabled={restoring || syncing}
            className="pl-5 pr-3 py-3 text-sm font-bold bg-white dark:bg-dark-bg-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-slate-700 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-r border-[#e1e3e4] dark:border-dark-border"
          >
            <span className={`material-symbols-outlined text-lg ${restoring ? 'animate-spin' : ''}`}>
              cloud_download
            </span>
            {restoring ? t('githubBackup.buttons.restoring') : t('githubBackup.buttons.restoreNow')}
          </button>
          <button
            type="button"
            aria-expanded={restoreMenuOpen}
            aria-haspopup="menu"
            onClick={() => { setRestoreMenuOpen(o => !o); setSyncMenuOpen(false); }}
            disabled={restoring || syncing}
            className="w-7 shrink-0 px-0 py-3 text-sm font-bold bg-white dark:bg-dark-bg-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-slate-700 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title={t('githubBackup.buttons.restoreNow')}
          >
            <span
              className={`material-symbols-outlined text-[1.125rem] leading-none transition-transform ${restoreMenuOpen ? 'rotate-180' : ''}`}
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
            >
              expand_more
            </span>
          </button>
        </div>
        {restoreMenuOpen &&
          restoreMenuFixed &&
          createPortal(
            <div
              ref={menuPanelRef}
              role="menu"
              style={{
                position: 'fixed',
                top: restoreMenuFixed.top,
                left: restoreMenuFixed.left,
                width: restoreMenuFixed.width,
                zIndex: 10050,
              }}
              className="box-border rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-white dark:bg-dark-bg-card py-2 px-2 shadow-lg"
            >
              <label
                title={t('githubBackup.restoreMenu.overwriteLocalHint')}
                className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary"
              >
                <input
                  type="checkbox"
                  role="menuitemcheckbox"
                  checked={overwriteLocal}
                  onChange={(e) => setOverwriteLocal(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-[#b71422] focus:ring-2 focus:ring-[#b71422]/40 focus:ring-offset-0"
                />
                <span className="min-w-0 flex-1 leading-snug break-words">{t('githubBackup.restoreMenu.overwriteLocal')}</span>
              </label>
            </div>,
            document.body
          )}
      </div>
      {/* Sync split button */}
      <div className="relative inline-flex" ref={syncSplitRef}>
        <div className="inline-flex rounded-xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => {
              setSyncMenuOpen(false);
              if (overwriteRemote) {
                setShowForceConfirm(true);
              } else {
                void onSync(false);
              }
            }}
            disabled={syncing || restoring}
            className="pl-5 pr-3 py-3 text-sm font-bold bg-[#b71422] hover:bg-[#a01220] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-r border-white/25"
          >
            <span className={`material-symbols-outlined text-lg ${syncing ? 'animate-spin' : ''}`}>
              cloud_upload
            </span>
            {syncing ? t('githubBackup.buttons.syncing') : t('githubBackup.buttons.syncNow')}
          </button>
          <button
            type="button"
            aria-expanded={syncMenuOpen}
            aria-haspopup="menu"
            onClick={() => { setSyncMenuOpen((o) => !o); setRestoreMenuOpen(false); }}
            disabled={syncing || restoring}
            className="w-7 shrink-0 px-0 py-3 text-sm font-bold bg-[#b71422] hover:bg-[#a01220] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title={t('githubBackup.syncMenu.openTitle')}
          >
            <span
              className={`material-symbols-outlined text-[1.125rem] leading-none transition-transform ${syncMenuOpen ? 'rotate-180' : ''}`}
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
            >
              expand_more
            </span>
          </button>
        </div>
        {syncMenuOpen &&
          syncMenuFixed &&
          createPortal(
            <div
              ref={menuPanelRef}
              role="menu"
              style={{
                position: 'fixed',
                top: syncMenuFixed.top,
                left: syncMenuFixed.left,
                width: syncMenuFixed.width,
                zIndex: 10050,
              }}
              className="box-border rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-white dark:bg-dark-bg-card py-2 px-2 shadow-lg"
            >
              <label
                title={t('githubBackup.syncMenu.overwriteRemoteHint')}
                className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary"
              >
                <input
                  type="checkbox"
                  role="menuitemcheckbox"
                  checked={overwriteRemote}
                  onChange={(e) => setOverwriteRemote(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-[#b71422] focus:ring-2 focus:ring-[#b71422]/40 focus:ring-offset-0"
                />
                <span className="min-w-0 flex-1 leading-snug break-words">{t('githubBackup.syncMenu.overwriteRemote')}</span>
              </label>
            </div>,
            document.body
          )}
      </div>

      {/* 强制同步确认框 */}
      {showForceConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white/95 dark:bg-dark-bg-card backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),0_18px_36px_-18px_rgba(0,0,0,0.3)] border border-white/50 dark:border-dark-border overflow-hidden flex flex-col items-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-amber-500 text-4xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                warning
              </span>
            </div>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white mb-2">{t('githubBackup.confirm.forceSyncTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed mb-8 px-4">
              {t('githubBackup.confirm.forceSyncMessage')}
              <br />{t('githubBackup.confirm.confirmContinue')}
            </p>
            <div className="w-full flex gap-3">
              <button
                onClick={() => {
                  setShowForceConfirm(false);
                  void onSync(true);
                }}
                className="w-full py-3.5 bg-[#b71422] hover:bg-[#a01220] text-white font-bold rounded-2xl shadow-lg shadow-[#b71422]/20 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {t('githubBackup.confirm.confirmSync')}
              </button>
              <button
                onClick={() => setShowForceConfirm(false)}
                className="w-full py-3.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-dark-bg-secondary transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 覆盖恢复确认框 */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white/95 dark:bg-dark-bg-card backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),0_18px_36px_-18px_rgba(0,0,0,0.3)] border border-white/50 dark:border-dark-border overflow-hidden flex flex-col items-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-amber-500 text-4xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                warning
              </span>
            </div>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white mb-2">{t('githubBackup.confirm.overwriteRestoreTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed mb-8 px-4">
              {t('githubBackup.confirm.overwriteRestoreMessage')}
              <br />{t('githubBackup.confirm.confirmContinue')}
            </p>
            <div className="w-full flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  void onRestore(true);
                }}
                className="w-full py-3.5 bg-[#b71422] hover:bg-[#a01220] text-white font-bold rounded-2xl shadow-lg shadow-[#b71422]/20 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {t('githubBackup.confirm.confirmRestore')}
              </button>
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="w-full py-3.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-dark-bg-secondary transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
