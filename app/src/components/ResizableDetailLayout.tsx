import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

if (typeof document !== 'undefined' && !document.getElementById('resizable-detail-layout-style')) {
  const style = document.createElement('style');
  style.id = 'resizable-detail-layout-style';
  style.textContent = `.drawer-width-transition { transition: width 0.3s ease-out, flex 0.3s ease-out; }`;
  document.head.appendChild(style);
}

interface ResizableDetailLayoutProps {
  children: ReactNode;
  /** 详情面板内容。传函数时接收 isClosing 参数，可用于关闭动画期间渲染快照内容 */
  panel: ReactNode | ((isClosing: boolean) => ReactNode);
  isPanelOpen: boolean;
  /** 主内容区最小宽度，默认 500 */
  mainMinWidth?: number;
  /** 面板默认宽度，默认 500 */
  defaultPanelWidth?: number;
  /** 面板最小宽度，默认 360 */
  minPanelWidth?: number;
  /** 面板最大宽度，默认 900 */
  maxPanelWidth?: number;
  /** 外层容器的附加 className，默认 "h-full" */
  className?: string;
}

function getRouteStorageKey(): string {
  if (typeof window === 'undefined') return 'resizable-panel-width:default';
  return `resizable-panel-width:${window.location.pathname}${window.location.hash}`;
}

function readStoredWidth(defaultWidth: number): number {
  try {
    const v = localStorage.getItem(getRouteStorageKey());
    const n = v ? Number(v) : NaN;
    return isFinite(n) && n > 0 ? n : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

export function ResizableDetailLayout({
  children,
  panel,
  isPanelOpen,
  mainMinWidth = 500,
  defaultPanelWidth = 500,
  minPanelWidth = 360,
  maxPanelWidth = 900,
  className = 'h-full',
}: ResizableDetailLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // 每次组件挂载时从 localStorage 读取最新宽度
  const [panelWidth, setPanelWidth] = useState(() => readStoredWidth(defaultPanelWidth));
  const [isDragging, setIsDragging] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  // 确保每次路由变化时都从 localStorage 读取最新值
  // 修复：Dashboard 和 SkillDownload 页面始终挂载，只在 display 切换，需要监听路由变化来恢复宽度
  useEffect(() => {
    const storedWidth = readStoredWidth(defaultPanelWidth);
    if (storedWidth !== panelWidth) {
      setPanelWidth(storedWidth);
      panelWidthRef.current = storedWidth;
    }
  }, [location.pathname, location.hash, defaultPanelWidth]); // 监听路由变化

  // 窗口缩小时自动将面板宽度 clamp 到有效范围内，避免内容溢出右侧
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const effectiveMax = Math.min(maxPanelWidth, el.clientWidth - mainMinWidth);
      setPanelWidth(prev => Math.min(prev, Math.max(minPanelWidth, effectiveMax)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxPanelWidth, mainMinWidth, minPanelWidth]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    document.body.classList.add('resizing');
    const startX = e.clientX;
    const startWidth = panelWidthRef.current;
    const handleMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      // 面板最大宽度取配置上限与「容器宽 - 主区最小宽」中的较小值，防止主内容区溢出
      const containerWidth = containerRef.current?.clientWidth ?? Infinity;
      const effectiveMax = Math.min(maxPanelWidth, containerWidth - mainMinWidth);
      setPanelWidth(Math.max(minPanelWidth, Math.min(effectiveMax, startWidth + delta)));
    };
    const handleUp = () => {
      setIsDragging(false);
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      try { localStorage.setItem(getRouteStorageKey(), String(panelWidthRef.current)); } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [minPanelWidth, maxPanelWidth, mainMinWidth]);

  // 关闭动画期间保持内容挂载，待 width 过渡结束后再卸载
  const [panelMounted, setPanelMounted] = useState(isPanelOpen);
  useEffect(() => {
    if (isPanelOpen) setPanelMounted(true);
  }, [isPanelOpen]);

  const isClosing = !isPanelOpen && panelMounted;

  return (
    <div ref={containerRef} className={`flex overflow-hidden ${className}`}>
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ minWidth: mainMinWidth }}>
        {children}
      </div>

      {/* 可拖拽详情面板 */}
      <div
        className={`overflow-hidden flex-shrink-0 bg-white dark:bg-dark-bg-card flex flex-row min-h-0 ${
          !isDragging ? 'drawer-width-transition' : ''
        }`}
        style={{ width: isPanelOpen ? panelWidth : 0 }}
        onTransitionEnd={(e) => {
          if (e.propertyName === 'width' && !isPanelOpen) setPanelMounted(false);
        }}
      >
        {panelMounted && (
          <>
            {/* 拖拽线 */}
            <div
              className={`flex-shrink-0 w-1.5 cursor-col-resize resizable-divider flex flex-col items-center justify-center group border-r border-[#e1e3e4] dark:border-dark-border ${
                isDragging
                  ? 'bg-[#b71422]'
                  : 'bg-gray-100 dark:bg-dark-bg-secondary hover:bg-[#b71422] dark:hover:bg-[#b71422]'
              }`}
              onMouseDown={handleResizeStart}
            >
              <div className="flex flex-col gap-0.5">
                <div className={`w-0.5 h-1.5 rounded-full transition-colors ${isDragging ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-white'}`} />
                <div className={`w-0.5 h-1.5 rounded-full transition-colors ${isDragging ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-white'}`} />
              </div>
            </div>

            {/* 面板内容 */}
            <div className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
              {typeof panel === 'function' ? panel(isClosing) : panel}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
