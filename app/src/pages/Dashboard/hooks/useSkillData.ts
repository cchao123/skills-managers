import { useState, useEffect } from 'react';
import { skillsApi, agentsApi } from '../../../api/tauri';
import type { SkillMetadata, AgentConfig } from '../../../types';

export const useSkillData = () => {
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);

      const isTauri = !!(window as any).__TAURI__;

      if (!isTauri) {
        throw new Error('Not running in Tauri environment');
      }

      console.log('Loading skills from API...');
      const data = await skillsApi.list();
      console.log('Skills loaded from API:', data);

      // Fix contradictory states
      const correctedData = data.map(skill => {
        const enabledAgentCount = Object.values(skill.agent_enabled || {}).filter(Boolean).length;

        // Main switch on but no sub-switches on -> turn off main switch
        if (skill.enabled === true && enabledAgentCount === 0) {
          console.log(`Fixing state: ${skill.name} - main switch OFF (no sub-switches enabled)`);
          return { ...skill, enabled: false };
        }

        // Main switch off but some sub-switches on -> turn on main switch
        if (skill.enabled === false && enabledAgentCount > 0) {
          console.log(`Fixing state: ${skill.name} - main switch ON (has sub-switches enabled)`);
          return { ...skill, enabled: true };
        }

        return skill;
      });

      setSkills(correctedData);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      console.log('Detecting agents...');
      const agentsData = await agentsApi.detect();
      console.log('Agents detected:', agentsData);
      setAgents(agentsData);
    } catch (error) {
      console.error('Failed to detect agents:', error);
    }
  };

  useEffect(() => {
    console.log('Dashboard mounted, loading skills and agents...');
    loadSkills();
    loadAgents();
  }, []);

  return {
    skills,
    setSkills,
    agents,
    loading,
    error,
    loadSkills,
    loadAgents,
  };
};
