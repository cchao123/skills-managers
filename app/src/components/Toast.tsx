import { useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';

export type ToastType = 'info' | 'warning' | 'error' | 'success';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
  leaving?: boolean;
}

const typeConfig: Record<ToastType, { icon: string; iconBg: string; iconColor: string }> = {
  info: {
    icon: 'info',
    iconBg: 'bg-info/10 dark:bg-info/20',
    iconColor: 'text-info',
  },
  success: {
    icon: 'check_circle',
    iconBg: 'bg-success/10 dark:bg-success/20',
    iconColor: 'text-success',
  },
  warning: {
    icon: 'warning',
    iconBg: 'bg-warning/10 dark:bg-warning/20',
    iconColor: 'text-warning',
  },
  error: {
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
      <div className="fixed top-20 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none w-[360px]">
        {toasts.map(toast => {
          const cfg = typeConfig[toast.type];
          const isCompact = !toast.description && toast.type === 'info';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1),0_0_1px_0_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] border border-slate-200/50 dark:border-white/10 flex gap-4 transform transition-all duration-300 ${
                isCompact ? 'p-3 items-center' : 'p-4'
              } ${toast.leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
            >
              {/* Icon */}
              <div className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                <span className={`material-symbols-outlined ${cfg.iconColor} ${isCompact ? 'text-xl' : ''}`}
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {cfg.icon}
                </span>
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
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
