import { useEffect, useState } from 'react';

/**
 * 根据 Tailwind 断点返回当前应显示的列数。
 *
 * 断点与 `columns-1 sm:columns-2 lg:columns-2 xl:columns-3 2xl:columns-4` 保持一致：
 * - `< 640px`   → 1
 * - `>= 640px`  → 2 (sm)
 * - `>= 1280px` → 2 (lg)
 * - `>= 1536px` → 3 (2xl)
 *
 * 用于手动瀑布流布局，让每列成为独立 DOM，以避免 CSS columns 在卡片
 * 高度变化（例如展开）时把后续卡片挤到下一列。
 */
const BREAKPOINTS: { query: string; cols: number }[] = [
  { query: '(min-width: 1536px)', cols: 3 },
  { query: '(min-width: 1280px)', cols: 2 },
  { query: '(min-width: 640px)', cols: 2 },
];

function resolveCount(): number {
  if (typeof window === 'undefined') return 1;
  for (const { query, cols } of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return cols;
  }
  return 1;
}

export function useColumnCount(): number {
  const [count, setCount] = useState<number>(resolveCount);

  useEffect(() => {
    const mqls = BREAKPOINTS.map(({ query }) => window.matchMedia(query));
    const update = () => setCount(resolveCount());
    mqls.forEach((mql) => mql.addEventListener('change', update));
    return () => mqls.forEach((mql) => mql.removeEventListener('change', update));
  }, []);

  return count;
}
