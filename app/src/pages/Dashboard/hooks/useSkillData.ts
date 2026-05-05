import { useState, useEffect, useCallback } from 'react';
import { useDebounceFn, useEventListener } from 'ahooks';
import { skillsApi, agentsApi } from '@/api/tauri';
import type { SkillMetadata, AgentConfig } from '@/types';
import { isTauri } from '@/lib/tauri-env';
import { WINDOW_EVENTS } from '@/constants/events';

/**
 * Schema v2 之后，`enabled` 由后端 scanner 根据 `agent_enabled` 派生，
 * 前端已无需再做"矛盾态修正"。本 Hook 只负责加载 / 刷新 / 窗口 focus 同步。
 */
export const useSkillData = () => {
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isTauri()) {
        throw new Error('Not running in Tauri environment');
      }

      if (import.meta.env.DEV) console.log('Loading skills from API...');
      const data = await skillsApi.list();
      if (import.meta.env.DEV) console.log('Skills loaded from API:', data);

      setSkills(data);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      if (import.meta.env.DEV) console.log('Detecting agents...');
      const agentsData = await agentsApi.detect();
      if (import.meta.env.DEV) console.log('Agents detected:', agentsData);
      setAgents(agentsData);
    } catch (error) {
      console.error('Failed to detect agents:', error);
    }
  }, []);

  // 静默刷新：只更新数据，不触发 loading（用于窗口重新获得焦点等场景）
  const refreshSkills = useCallback(async () => {
    try {
      if (!isTauri()) return;
      const data = await skillsApi.list();
      setSkills(data);
    } catch (err) {
      console.error('Failed to refresh skills:', err);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) console.log('Dashboard mounted, loading skills and agents...');
    loadSkills();
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 窗口重新获得焦点时静默同步列表，防抖 250ms 避免 Windows 多次触发
  const { run: scheduleRefresh } = useDebounceFn(
    () => {
      void refreshSkills();
      void loadAgents();
    },
    { wait: 250 },
  );

  useEventListener('focus', scheduleRefresh, { target: window });
  // 其它页面（如 GitHub 同步/恢复）显式通知刷新
  useEventListener(WINDOW_EVENTS.skillsRefresh as keyof WindowEventMap, scheduleRefresh, { target: window });

  return {
    skills,
    setSkills,
    agents,
    loading,
    error,
    loadSkills,
    refreshSkills,
    loadAgents,
  };
};
