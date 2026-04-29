import { useCallback, useEffect, useState } from 'react';
import { LOCAL_STORAGE_KEYS } from '@/constants';

export interface SearchBarPrefs {
  /** 显示左侧"按前缀过滤"漏斗按钮 */
  showFilter: boolean;
  /** 显示中间搜索输入框 */
  showSearch: boolean;
  /** 显示右侧帮助 / 日志按钮组 */
  showActions: boolean;
}

const DEFAULT_PREFS: SearchBarPrefs = {
  showFilter: true,
  showSearch: true,
  showActions: true,
};

function readPrefs(): SearchBarPrefs {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.searchBarPrefs);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFS };
    return {
      showFilter: typeof parsed.showFilter === 'boolean' ? parsed.showFilter : DEFAULT_PREFS.showFilter,
      showSearch: typeof parsed.showSearch === 'boolean' ? parsed.showSearch : DEFAULT_PREFS.showSearch,
      showActions: typeof parsed.showActions === 'boolean' ? parsed.showActions : DEFAULT_PREFS.showActions,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function writePrefs(prefs: SearchBarPrefs): void {
  try {
    const value = JSON.stringify(prefs);
    localStorage.setItem(LOCAL_STORAGE_KEYS.searchBarPrefs, value);
    // 同 tab 内派发以便其它订阅者感知变更
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LOCAL_STORAGE_KEYS.searchBarPrefs,
        newValue: value,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * 读取并修改 Dashboard 搜索栏的显示偏好（过滤按钮 / 搜索框 / 帮助&日志按钮组）。
 * 多处订阅时通过 storage 事件保持一致。
 */
export function useSearchBarPrefs() {
  const [prefs, setPrefsState] = useState<SearchBarPrefs>(readPrefs);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key !== LOCAL_STORAGE_KEYS.searchBarPrefs) return;
      setPrefsState(readPrefs());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setPref = useCallback(<K extends keyof SearchBarPrefs>(key: K, value: SearchBarPrefs[K]) => {
    setPrefsState((prev) => {
      const next = { ...prev, [key]: value };
      writePrefs(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState({ ...DEFAULT_PREFS });
    writePrefs({ ...DEFAULT_PREFS });
  }, []);

  return { prefs, setPref, resetPrefs };
}
