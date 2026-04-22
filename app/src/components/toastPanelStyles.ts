/**
 * 与 Toast 卡片同一套「液态玻璃」视觉（固定 token，其它弹窗只引用这里，避免和 Toast 各写一套差很多）。
 *
 * 要点：暗色用略高的 white/α + saturate + 更强 blur，否则在 #141414 类背景上几乎像实色块。
 */
const LIQUID_GLASS_BASE_CLASS =
  [
    'isolate',
    'bg-white/80 dark:bg-white/[0.12]',
    'backdrop-blur-2xl backdrop-saturate-150',
    'rounded-2xl',
    'border border-slate-200/60 dark:border-white/[0.14]',
    'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.12),0_0_1px_0_rgba(0,0,0,0.08)]',
    'dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.06)]',
    'transform transition-all duration-300',
  ].join(' ');

/** Toast 横排：左图标 + 文案 + 关闭 */
export const LIQUID_GLASS_TOAST_PANEL_CLASS =
  `pointer-events-auto w-full flex gap-4 ${LIQUID_GLASS_BASE_CLASS}`;
