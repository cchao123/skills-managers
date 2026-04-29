/**
 * 主开关的纯视觉组件 + 状态样式表。
 *
 * 抽出来的原因：SkillCard 的实际开关与 View Guide 里的图例使用同一套颜色/位置约定，
 * 把样式放在唯一来源里，避免两处各维护一份 Tailwind class 串。
 */
import type { MouseEventHandler } from 'react';

export type MainToggleState = 'off' | 'nativeOnly' | 'on';

interface ToggleStyle {
  track: string;
  thumbPosition: string;
  thumbBg: string;
}

const STYLE_MAP: Record<MainToggleState, ToggleStyle> = {
  off: {
    track: 'bg-[#CBD5E0] dark:bg-gray-600',
    thumbPosition: 'translate-x-0',
    thumbBg: 'bg-white',
  },
  nativeOnly: {
    track: 'bg-[#CBD5E0] dark:bg-gray-600',
    thumbPosition: 'translate-x-4',
    thumbBg: 'bg-amber-200/80',
  },
  on: {
    track: 'bg-[#b71422]',
    thumbPosition: 'translate-x-4',
    thumbBg: 'bg-white',
  },
};

/** 图例遍历顺序（保持和帮助弹层一致） */
export const MAIN_TOGGLE_STATES: readonly MainToggleState[] = ['off', 'nativeOnly', 'on'] as const;

interface Props {
  state: MainToggleState;
  /** 提供 onClick 时渲染为 button；否则渲染为 span，仅作图例展示 */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  className?: string;
}

export const MainToggleIndicator: React.FC<Props> = ({ state, onClick, title, className = '' }) => {
  const { track, thumbPosition, thumbBg } = STYLE_MAP[state];
  const interactive = typeof onClick === 'function';
  const transition = interactive ? 'transition-all' : '';
  const cursor = interactive ? 'cursor-pointer' : '';

  const thumb = (
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm ${thumbBg} ${thumbPosition} ${transition}`}
    />
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={`relative w-9 h-5 rounded-full flex-shrink-0 ${track} ${transition} ${cursor} ${className}`}
      >
        {thumb}
      </button>
    );
  }

  return (
    <span
      title={title}
      className={`relative inline-block w-9 h-5 rounded-full flex-shrink-0 ${track} ${className}`}
    >
      {thumb}
    </span>
  );
};
