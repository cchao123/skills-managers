import { useMemo } from 'react';
import type { AgentConfig } from '@/types';
import { useHiddenAgents } from '@/hooks/useHiddenAgents';

/** 返回已检测安装且未被用户隐藏的 agent 列表，结果记忆化。 */
export function useVisibleAgents(agents: AgentConfig[]): AgentConfig[] {
  const hidden = useHiddenAgents();
  return useMemo(
    () => agents.filter(a => a.detected && !hidden.has(a.name)),
    [agents, hidden],
  );
}
