import { useEffect, useState } from 'react';
import { LOCAL_STORAGE_KEYS } from '@/constants';

const DEFAULT_HIDDEN_AGENTS = new Set(['opencode', 'trae', 'qoder', 'antigravity', 'kiro']);

export function readHiddenAgents(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.hiddenAgents);
    if (!raw) return new Set(DEFAULT_HIDDEN_AGENTS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_HIDDEN_AGENTS);
    return new Set(parsed.filter((x: unknown) => typeof x === 'string'));
  } catch {
    return new Set(DEFAULT_HIDDEN_AGENTS);
  }
}

/** 从 localStorage 读取被隐藏的 agent name 集合，同 tab 内及跨 tab 均可响应变化。 */
export function useHiddenAgents(): Set<string> {
  const [hidden, setHidden] = useState<Set<string>>(readHiddenAgents);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key && e.key !== LOCAL_STORAGE_KEYS.hiddenAgents) return;
      setHidden(readHiddenAgents());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return hidden;
}
