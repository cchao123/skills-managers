import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { Icon } from '@/components/Icon';
export interface ContextMenuItem {
  /** 菜单项展示文案 */
  label: string;
  /** material-symbols 图标名（可选） */
  icon?: string;
  /** 图标内联样式（如 fontVariationSettings） */
  iconStyle?: CSSProperties;
  /** 点击回调，菜单会自动关闭，无需手动调用 onClose */
  onClick: () => void;
  /** 禁用态 */
  disabled?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  /** 鼠标点击位置（视口坐标） */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * 通用浮动上下文菜单：定位在鼠标坐标处，自动避开视口边界；
 * 点击外部 / ESC / 滚动 / resize 时关闭。
 *
 * 用法：
 *   <ContextMenu open={state.open} x={state.x} y={state.y}
 *                items={[{ label, icon, onClick }]}
 *                onClose={...} />
 */
export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let nx = x;
    let ny = y;
    if (nx + rect.width + margin > vw) nx = vw - rect.width - margin;
    if (ny + rect.height + margin > vh) ny = vh - rect.height - margin;
    if (nx < margin) nx = margin;
    if (ny < margin) ny = margin;
    setPos({ x: nx, y: ny });
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScrollOrResize = () => onClose();
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', top: pos.y, left: pos.x, zIndex: 9999 }}
      className="min-w-[160px] py-1 bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-lg shadow-xl text-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f3f4f5] dark:hover:bg-dark-hover text-slate-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {item.icon && (
            <Icon name={item.icon} className="text-base text-[#b71422]"
              style={item.iconStyle}
              aria-hidden="true" />
          )}
          <span className="flex-1 text-left">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default ContextMenu;
