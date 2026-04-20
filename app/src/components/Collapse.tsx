import React, { useState } from 'react';

interface CollapseProps {
  title: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
  defaultOpen?: boolean;
}

export const Collapse: React.FC<CollapseProps> = ({
  title,
  children,
  maxHeight = '2000px',
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl shadow-sm border border-[#e1e3e4] dark:border-dark-border overflow-hidden">
      <button
        onClick={(e) => {
          // 检查点击的是否是链接或链接的子元素
          const target = e.target as HTMLElement;
          if (target.tagName === 'A' || target.closest('a')) {
            return;
          }
          setOpen(!open);
        }}
        className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
      >
        {title}
        <span className={`material-symbols-outlined text-slate-400 dark:text-gray-500 text-2xl transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? maxHeight : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
