import { useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';

import { Icon } from '@/components/Icon';
const TOAST_TYPE = {
  Info: 'info',
  Warning: 'warning',
  Error: 'error',
  Success: 'success',
} as const;

type ToastType = typeof TOAST_TYPE[keyof typeof TOAST_TYPE];

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
  leaving?: boolean;
}

const typeConfig: Record<ToastType, { icon: string; iconBg: string; iconColor: string }> = {
  [TOAST_TYPE.Info]: {
    icon: 'info',
    iconBg: 'bg-info/10 dark:bg-info/20',
    iconColor: 'text-info',
  },
  [TOAST_TYPE.Success]: {
    icon: 'check_circle',
    iconBg: 'bg-success/10 dark:bg-success/20',
    iconColor: 'text-success',
  },
  [TOAST_TYPE.Warning]: {
    icon: 'warning',
    iconBg: 'bg-warning/10 dark:bg-warning/20',
    iconColor: 'text-warning',
  },
  [TOAST_TYPE.Error]: {
    icon: 'error',
    iconBg: 'bg-error/10 dark:bg-error/20',
    iconColor: 'text-error',
  },
};

interface ToastContextType {
  showToast: (type: ToastType, message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message, description }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — top-right stacked */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse items-end gap-3 pointer-events-none w-[360px]">
        {toasts.map(toast => {
          const cfg = typeConfig[toast.type];
          const isCompact = !toast.description && toast.type === TOAST_TYPE.Info;
          return (
            <div
              key={toast.id}
              className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} ${
                isCompact ? 'p-3 items-center' : 'p-4'
              } ${toast.leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
            >
              {/* Icon */}
              <div className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon
                  name={cfg.icon}
                  className={`${cfg.iconColor} ${isCompact ? 'text-xl' : ''}`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-bold text-sm text-slate-900 dark:text-white break-words">{toast.message}</p>
                </div>
                {toast.description && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-normal">{toast.description}</p>
                )}
              </div>

              {/* Close */}
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 self-start transition-colors flex-shrink-0"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
