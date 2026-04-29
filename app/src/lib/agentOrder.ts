import { LOCAL_STORAGE_KEYS } from '@/constants';

/** 读取用户保存的 agent 排列顺序（name 数组） */
export function loadAgentsOrder(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.agentsOrder);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as string[];
  } catch {
    // ignore quota / private mode errors
    return [];
  }
}

/** 保存 agent 排列顺序（name 数组） */
export function saveAgentsOrder(order: string[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.agentsOrder, JSON.stringify(order));
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * 按用户保存的顺序对 agents 数组排序，未出现在顺序中的 agent 追加到末尾。
 */
export function sortAgentsByStoredOrder<T extends { name: string }>(agents: T[]): T[] {
  const order = loadAgentsOrder();
  if (!order.length) return agents;
  const orderSet = new Set(order);
  const map = new Map(agents.map(a => [a.name, a]));
  const sorted = order.filter(n => map.has(n)).map(n => map.get(n) as T);
  agents.forEach(a => { if (!orderSet.has(a.name)) sorted.push(a); });
  return sorted;
}
