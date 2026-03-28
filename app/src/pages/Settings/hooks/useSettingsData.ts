import { useState, useEffect } from 'react';
import { agentsApi } from '../../../api/tauri';
import type { AgentConfig } from '../../../types';

export const useSettingsData = () => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [linkingStrategy, setLinkingStrategy] = useState<'Symlink' | 'Copy'>('Symlink');

  const loadSettings = async () => {
    try {
      const agentsData = await agentsApi.detect();
      setAgents(agentsData);
      const config = await agentsApi.getConfig();
      setLinkingStrategy(config.linking_strategy);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleDetectAgents = async () => {
    try {
      const updatedAgents = await agentsApi.detect();
      setAgents(updatedAgents);
    } catch (error) {
      console.error('Failed to detect agents:', error);
    }
  };

  const handleSetStrategy = async (strategy: 'Symlink' | 'Copy') => {
    try {
      await agentsApi.setLinkingStrategy(strategy);
      setLinkingStrategy(strategy);
    } catch (error) {
      console.error('Failed to set linking strategy:', error);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await agentsApi.openFolder();
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    agents,
    linkingStrategy,
    handleDetectAgents,
    handleSetStrategy,
    handleOpenFolder,
  };
};
