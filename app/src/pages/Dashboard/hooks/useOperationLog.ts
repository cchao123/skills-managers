/**
 * 「操作日志」持久化存储 + React 订阅。
 *
 * 数据写入任何地方（`handleAddToRoot`、`useDragDrop` 等）都通过 `appendOperationLog` 推；
 * 任何组件需要读都可以 `useOperationLog()`。
 *
 * 存储限制：最多 MAX_ENTRIES 条，超出丢最旧的；localStorage 写失败直接忽略（例如隐私模式）。
 */
import { useEffect, useState } from 'react';

export type OperationLogType = 'copyFromSource' | 'dragImport' | 'enableAgent';

export interface OperationLogEntry {
  id: string;
  timestamp: number;
  type: OperationLogType;
  skillName: string;
  /** `copyFromSource` / `enableAgent` 时记录来源 agent 名（例如 `claude-code`） */
  source?: string;
  /** `enableAgent` 时记录被启用的目标 agent 名（例如 `cursor`） */
  targetAgent?: string;
  /** `dragImport` 时填被导入的源文件夹路径 */
  folderPath?: string;
}

const STORAGE_KEY = 'skills-manager:operation-log';
const MAX_ENTRIES = 100;

type Listener = (entries: OperationLogEntry[]) => void;

const listeners = new Set<Listener>();
let cache: OperationLogEntry[] | null = null;

const load = (): OperationLogEntry[] => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
};

const save = (entries: OperationLogEntry[]) => {
  cache = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* 忽略配额/隐私模式错误 */
  }
  listeners.forEach(l => l(entries));
};

export const appendOperationLog = (entry: Omit<OperationLogEntry, 'id' | 'timestamp'>) => {
  const next: OperationLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  save([next, ...load()].slice(0, MAX_ENTRIES));
};

export const clearOperationLog = () => save([]);

/** React hook：订阅日志变化并返回当前全部条目（新 → 旧） */
export const useOperationLog = (): OperationLogEntry[] => {
  const [entries, setEntries] = useState<OperationLogEntry[]>(load);

  useEffect(() => {
    const listener = (next: OperationLogEntry[]) => setEntries([...next]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return entries;
};
