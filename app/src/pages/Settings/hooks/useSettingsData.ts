import { useRequest } from 'ahooks';
import { agentsApi } from '@/api/tauri';
import type { AgentConfig } from '@/types';

export const useSettingsData = () => {
  const { data: agents = [] as AgentConfig[], run: loadAgents } = useRequest(
    () => agentsApi.detect(),
    {
      onError: (error) => console.error('Failed to detect agents:', error),
    },
  );

  return { agents, loadAgents };
};
