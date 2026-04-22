import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import {
  clearOperationLog,
  useOperationLog,
  type OperationLogEntry,
} from '@/pages/Dashboard/hooks/useOperationLog';

interface Props {
  anchorRect: DOMRect;
  onClose: () => void;
}

const ICON_BY_TYPE: Record<OperationLogEntry['type'], string> = {
  copyFromSource: 'file_copy',
  dragImport: 'upload',
  enableAgent: 'toggle_on',
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mo}-${dd} ${hh}:${mm}`;
};

export const OperationLogPopover: React.FC<Props> = ({ anchorRect, onClose }) => {
  const { t } = useTranslation();
  const entries = useOperationLog();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const vw = window.innerWidth;
  const width = Math.min(380, vw - 16);
  let left = anchorRect.right - width;
  left = Math.max(8, Math.min(left, vw - width - 8));

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 6,
        left,
        width,
        zIndex: 9998,
      }}
      className="pointer-events-auto"
    >
      <div className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} max-h-[min(70vh,28rem)] overflow-hidden p-3 animate-toast-in flex-col`}>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {t('dashboard.operationLog.panelTitle')}
          </p>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={clearOperationLog}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {t('dashboard.operationLog.clear')}
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-gray-500">
            {t('dashboard.operationLog.empty')}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {entries.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
              >
                <span
                  className="material-symbols-outlined text-base text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0"
                  style={{ fontSize: '16px' }}
                >
                  {ICON_BY_TYPE[entry.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-slate-700 dark:text-gray-200 break-words">
                    {entry.type === 'copyFromSource'
                      ? t('dashboard.operationLog.copyFromSource', {
                          source: entry.source ?? '-',
                          skill: entry.skillName,
                        })
                      : entry.type === 'enableAgent'
                        ? t('dashboard.operationLog.enableAgent', {
                            skill: entry.skillName,
                            target: entry.targetAgent ?? '-',
                            source: entry.source ?? '-',
                          })
                        : t('dashboard.operationLog.dragImport', { skill: entry.skillName })}
                  </p>
                  {entry.folderPath && (
                    <p
                      className="text-[10px] leading-tight text-slate-400 dark:text-gray-500 truncate"
                      title={entry.folderPath}
                    >
                      {entry.folderPath}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-gray-500 flex-shrink-0 mt-0.5 tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
};
