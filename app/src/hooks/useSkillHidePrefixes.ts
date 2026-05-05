import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventListener } from 'ahooks';
import { LOCAL_STORAGE_KEYS } from '@/constants';
import { agentsApi } from '@/api/tauri';
import { isTauri } from '@/lib/tauri-env';

/**
 * 异步把 prefix 列表同步到后端（仅在 Tauri 环境下）。
 * 错误只记录不抛，避免影响前端 UI。
 */
function syncToBackend(prefixes: string[]): void {
  if (!isTauri()) return;
  agentsApi.setSkillHidePrefixes(prefixes).catch((err) => {
    console.warn('[useSkillHidePrefixes] failed to sync hide prefixes:', err);
  });
}

/**
 * 从 localStorage 读取 skill 隐藏前缀列表，容错：
 * - 非数组 / 解析失败 / 异常值一律视为空列表；
 * - 自动去重、去空白、按输入顺序保留。
 */
function readHidePrefixes(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.skillHidePrefixes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
    }
    return result;
  } catch {
    return [];
  }
}

function writeHidePrefixes(prefixes: string[]): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.skillHidePrefixes,
      JSON.stringify(prefixes),
    );
    // 自行派发 storage 事件以便同 tab 内订阅者感知变更
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LOCAL_STORAGE_KEYS.skillHidePrefixes,
        newValue: JSON.stringify(prefixes),
      }),
    );
  } catch {
    /* ignore */
  }
  // 托盘菜单由原生代码构建，读不到 localStorage，需要额外推送给后端
  syncToBackend(prefixes);
}

/**
 * 管理"按前缀隐藏技能"的配置，跨页面/跨 tab 保持同步。
 */
export function useSkillHidePrefixes() {
  const [prefixes, setPrefixesState] = useState<string[]>(readHidePrefixes);
  const didInitialSync = useRef(false);

  useEventListener('storage', (e: StorageEvent) => {
    if (e.key && e.key !== LOCAL_STORAGE_KEYS.skillHidePrefixes) return;
    setPrefixesState(readHidePrefixes());
  }, { target: window });

  // 应用启动时把 localStorage 中的规则推一次给后端，
  // 兼容"升级前已有规则但后端 config.json 还没这个字段"的老用户。
  useEffect(() => {
    if (didInitialSync.current) return;
    didInitialSync.current = true;
    syncToBackend(prefixes);
    // 只在挂载时跑一次，不依赖 prefixes，否则会每次变更都重复 invoke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPrefixes = useCallback((next: string[]) => {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const item of next) {
      const trimmed = (item ?? '').trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    setPrefixesState(normalized);
    writeHidePrefixes(normalized);
  }, []);

  const addPrefix = useCallback((prefix: string) => {
    const trimmed = prefix.trim();
    if (!trimmed) return;
    setPrefixesState((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      writeHidePrefixes(next);
      return next;
    });
  }, []);

  const removePrefix = useCallback((prefix: string) => {
    setPrefixesState((prev) => {
      const next = prev.filter((p) => p !== prefix);
      if (next.length === prev.length) return prev;
      writeHidePrefixes(next);
      return next;
    });
  }, []);

  return { prefixes, setPrefixes, addPrefix, removePrefix };
}

/**
 * 判断一个 skill id / name 是否命中任一隐藏前缀。
 * 大小写不敏感，空列表直接返回 false。
 */
export function matchesAnyPrefix(id: string, prefixes: string[]): boolean {
  if (!prefixes.length) return false;
  const lower = id.toLowerCase();
  return prefixes.some((p) => lower.startsWith(p.toLowerCase()));
}
