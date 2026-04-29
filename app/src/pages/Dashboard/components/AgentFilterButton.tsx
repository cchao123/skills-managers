import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import { Icon } from '@/components/Icon';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { useVisibleAgents } from '@/pages/Dashboard/hooks/useVisibleAgents';

interface AgentFilterButtonProps {
  /** 已检测到的 agents */
  agents: AgentConfig[];
  /** 当前选中的 source id；'' = 不筛选 */
  selected: string;
  /** 切换选中（点同一项视为取消，传空串） */
  onSelect: (value: string) => void;
}

interface OptionItem {
  id: string;
  label: string;
  icon: string;
  invertInDark: boolean;
}

/**
 * 顶部搜索栏右侧的「按 Agent 快筛」入口：
 * - 未选中时显示 funnel 图标
 * - 选中时按钮上显示 agent 头像 + 红点
 * - 点击展开浮层；Esc / 外部点击 / 滚动 / resize 关闭
 */
export const AgentFilterButton: React.FC<AgentFilterButtonProps> = ({
  agents,
  selected,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleAgents = useVisibleAgents(agents);

  const options: OptionItem[] = [
    {
      id: SOURCE.Global,
      label: t('dashboard.source.global'),
      icon: OCTOPUS_LOGO_URL,
      invertInDark: false,
    },
    ...visibleAgents.map((a) => ({
      id: a.name,
      label: a.display_name,
      icon: getAgentIcon(a.name),
      invertInDark: needsInvertInDark(a.name),
    })),
  ];

  const selectedOption = options.find((o) => o.id === selected) ?? null;

  const updateAnchor = () => {
    const el = buttonRef.current;
    if (!el) return;
    setAnchor(el.getBoundingClientRect());
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleMouseEnter = () => {
    cancelClose();
    updateAnchor();
    setOpen(true);
  };

  // 浮层定位跟随 resize / scroll
  useLayoutEffect(() => {
    if (!open) return;
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (id: string) => {
    onSelect(selected === id ? '' : id);
    setOpen(false);
  };

  // 浮层位置：按钮下方右对齐
  const popoverStyle = anchor
    ? (() => {
        const width = 200;
        const margin = 8;
        const vw = window.innerWidth;
        let left = anchor.right - width;
        left = Math.max(margin, Math.min(left, vw - width - margin));
        return {
          position: 'fixed' as const,
          top: anchor.bottom + 6,
          left,
          width,
          zIndex: 9998,
        };
      })()
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={scheduleClose}
        title={
          selectedOption
            ? t('dashboard.agentFilter.activeTitle', { name: selectedOption.label })
            : t('dashboard.agentFilter.title')
        }
        className={`relative shrink-0 h-9 px-2 rounded-lg flex items-center gap-1 transition-colors border ${
          selectedOption
            ? 'bg-white dark:bg-dark-bg-card border-[#b71422]/40 dark:border-[#fca5a5]/40'
            : 'bg-white dark:bg-dark-bg-card border-[#e1e3e4] dark:border-dark-border hover:border-slate-300 dark:hover:border-gray-600'
        }`}
      >
        {selectedOption ? (
          <>
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <img
                src={selectedOption.icon}
                alt=""
                className={`w-full h-full object-contain ${
                  selectedOption.invertInDark ? 'dark:invert' : ''
                }`}
              />
            </span>
            <span className="text-xs font-bold text-[#b71422] dark:text-[#fca5a5]">
              {selectedOption.label}
            </span>
          </>
        ) : (
          <span className="text-xs font-bold tracking-wider text-slate-600 dark:text-gray-300 px-1">
            {t('dashboard.agentFilter.all')}
          </span>
        )}
        <Icon
          name="expand_more"
          className="text-base text-slate-400 dark:text-gray-500"
        />
        {selectedOption && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#b71422] border-2 border-white dark:border-dark-bg-secondary" />
        )}
      </button>

      {open && popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-lg shadow-xl py-1 select-none animate-toast-in"
          >
            <div className="px-3 py-2 flex items-center justify-between border-b border-[#e1e3e4] dark:border-dark-border">
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-400 font-bold">
                {t('dashboard.agentFilter.title')}
              </span>
              {selected && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect('');
                    setOpen(false);
                  }}
                  className="text-[11px] text-[#b71422] hover:underline font-bold"
                >
                  {t('dashboard.agentFilter.clear')}
                </button>
              )}
            </div>
            <ul className="py-1 max-h-72 overflow-y-auto">
              {options.map((opt) => {
                const isSelected = selected === opt.id;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(opt.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'text-[#b71422] dark:text-[#fca5a5] font-semibold bg-[#fff5f6] dark:bg-[#7f1d1d]/20'
                          : 'text-slate-700 dark:text-gray-200 hover:bg-[#f3f4f5] dark:hover:bg-dark-hover'
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <img
                          src={opt.icon}
                          alt=""
                          className={`w-full h-full object-contain ${
                            opt.invertInDark ? 'dark:invert' : ''
                          }`}
                        />
                      </span>
                      <span className="flex-1 text-left truncate">{opt.label}</span>
                      {isSelected && (
                        <Icon
                          name="check"
                          className="text-base text-[#b71422] dark:text-[#fca5a5] flex-shrink-0"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
};

export default AgentFilterButton;
