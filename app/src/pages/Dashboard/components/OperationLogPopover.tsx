import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import {
  clearOperationLog,
  useOperationLog,
  type OperationLogEntry,
} from '@/pages/Dashboard/hooks/useOperationLog';

import { Icon } from '@/components/Icon';
interface Props {
  anchorRect: DOMRect;
  onClose: () => void;
  /** 鼠标进入面板（hover 模式下用于取消关闭计时） */
  onPanelMouseEnter?: () => void;
  /** 鼠标离开面板（hover 模式下用于启动关闭计时） */
  onPanelMouseLeave?: () => void;
  /** hover 触发时禁用 backdrop（避免占用整屏阻挡其他交互） */
  hideBackdrop?: boolean;
  /** 弹窗向上展开（锚点在底部时使用） */
  openAbove?: boolean;
  /** 只显示指定类型的日志条目 */
  filterTypes?: OperationLogEntry['type'][];
  /** 自定义面板标题 */
  panelTitle?: string;
  /** 自定义空状态文案 */
  emptyMessage?: string;
}

const ICON_BY_TYPE: Record<OperationLogEntry['type'], string> = {
  copyFromSource: 'file_copy',
  dragImport: 'upload',
  enableAgent: 'toggle_on',
  download: 'download',
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

export const OperationLogPopover: React.FC<Props> = ({
  anchorRect,
  onClose,
  onPanelMouseEnter,
  onPanelMouseLeave,
  hideBackdrop = false,
  openAbove = false,
  filterTypes,
  panelTitle,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const allEntries = useOperationLog();
  const entries = filterTypes ? allEntries.filter(e => filterTypes.includes(e.type)) : allEntries;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const vw = window.innerWidth;
  const width = Math.min(380, vw - 16);
  let left = anchorRect.right - width;
  left = Math.max(8, Math.min(left, vw - width - 8));

  // hover 模式下面板向上贴近按钮，并预留一个 bridge 区便于鼠标从按钮平滑移入面板
  const bridge = onPanelMouseEnter ? 12 : 0;

  return createPortal(
    <>
      {!hideBackdrop && (
        // 透明 backdrop：拦截点击并关闭 popover。
        // 必须覆盖在 header 的 `data-tauri-drag-region` 之上，否则 OS 会吞掉 mousedown
        // 导致点 header 关不掉弹窗。backdrop 本身不是 drag region，事件能正常冒泡。
        <div
          onMouseDown={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9997,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        />
      )}
      <div
        style={{
          position: 'fixed',
          ...(openAbove
            ? { bottom: window.innerHeight - anchorRect.top + bridge, paddingBottom: bridge }
            : { top: anchorRect.bottom - bridge, paddingTop: bridge }),
          left,
          width,
          zIndex: 9998,
        }}
        className="pointer-events-auto"
        onMouseEnter={onPanelMouseEnter}
        onMouseLeave={onPanelMouseLeave}
      >
      <div className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} max-h-[min(70vh,28rem)] overflow-hidden p-3 animate-toast-in flex-col`}>
        <div className="flex items-center justify-between mb-2 px-1 gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {panelTitle ?? t('dashboard.operationLog.panelTitle')}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={clearOperationLog}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {t('dashboard.operationLog.clear')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('dashboard.operationLog.close')}
              className="flex items-center justify-center w-6 h-6 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              <Icon name="close" style={{ fontSize: '16px' }} />
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-gray-500">
            {emptyMessage ?? t('dashboard.operationLog.empty')}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {entries.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
              >
                <Icon name={ICON_BY_TYPE[entry.type]} className="text-base text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0"
                  style={{ fontSize: '16px' }} />
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
                        : entry.type === 'download'
                          ? t('dashboard.operationLog.download', {
                              skill: entry.skillName,
                              target: entry.downloadTarget ?? 'Root',
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
      </div>
    </>,
    document.body,
  );
};
