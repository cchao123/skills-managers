import { useMemo } from 'react';
import type { AgentConfig } from '@/types';

/** 返回所有已检测安装 (`detected === true`) 的 agent 列表，结果记忆化。 */
export const useDetectedAgents = (agents: AgentConfig[]): AgentConfig[] =>
  useMemo(() => agents.filter(a => a.detected), [agents]);
