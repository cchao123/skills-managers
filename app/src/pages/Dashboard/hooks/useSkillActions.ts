import { useCallback } from 'react';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import type { SkillMetadata } from '@/types';

export const useSkillActions = (
  _skills: SkillMetadata[],
  setSkills: React.Dispatch<React.SetStateAction<SkillMetadata[]>>
) => {
  const { showToast } = useToast();

  const handleToggleSkill = useCallback(async (skill: SkillMetadata) => {
    try {
      const newState = !skill.enabled;

      if (newState === false) {
        // Turn off main switch -> backup current config, then turn off all sub-switches
        console.log('Turning off main switch, backing up config and disabling all sub-switches');

        const agentsToDisable = Object.keys(skill.agent_enabled || {}).filter(
          agent => skill.agent_enabled[agent] === true
        );

        // Immediately update local state
        setSkills(prevSkills =>
          prevSkills.map(s =>
            s.id === skill.id
              ? {
                  ...s,
                  enabled: false,
                  agent_enabled_backup: { ...s.agent_enabled },
                  agent_enabled: Object.keys(s.agent_enabled || {}).reduce((acc, agent) => {
                    acc[agent] = false;
                    return acc;
                  }, {} as Record<string, boolean>)
                }
              : s
          )
        );

        // Async call API to disable all agents
        agentsToDisable.forEach(agent => {
          skillsApi.disable(skill.id, agent).catch(error => {
            console.error(`Failed to disable ${skill.id} for agent ${agent}:`, error);
          });
        });
      } else {
        // Turn on main switch -> restore previous config
        console.log('Turning on main switch, restoring previous config');

        const agentStatesToRestore = skill.agent_enabled_backup || skill.agent_enabled || {};
        const agentsToEnable = Object.keys(agentStatesToRestore).filter(
          agent => agentStatesToRestore[agent] === true
        );

        // Immediately update local state
        setSkills(prevSkills =>
          prevSkills.map(s =>
            s.id === skill.id
              ? {
                  ...s,
                  enabled: true,
                  agent_enabled: agentStatesToRestore,
                  agent_enabled_backup: undefined
                }
              : s
          )
        );

        // Async call API to enable all agents
        agentsToEnable.forEach(agent => {
          skillsApi.enable(skill.id, agent).catch(error => {
            console.error(`Failed to enable ${skill.id} for agent ${agent}:`, error);
          });
        });
      }
    } catch (error) {
      console.error('Failed to toggle skill:', error);
    }
  }, [setSkills]);

  const handleToggleAgent = useCallback(async (skill: SkillMetadata, agentName: string) => {
    try {
      const isEnabled = skill.agent_enabled[agentName];
      const newState = !isEnabled;

      const currentEnabledCount = Object.values(skill.agent_enabled || {}).filter(Boolean).length;
      const newEnabledCount = newState ? currentEnabledCount + 1 : currentEnabledCount - 1;

      const shouldUpdateMainSwitch =
        (newState === true && skill.enabled === false) ||
        (newState === false && newEnabledCount === 0);

      // Immediately update local state
      setSkills(prevSkills =>
        prevSkills.map(s =>
          s.id === skill.id
            ? {
                ...s,
                agent_enabled: {
                  ...s.agent_enabled,
                  [agentName]: newState
                },
                enabled: shouldUpdateMainSwitch ? (newEnabledCount > 0) : s.enabled
              }
            : s
        )
      );

      // Async call API
      if (isEnabled) {
        console.log(`Disabling skill ${skill.name} for agent ${agentName}`);
        skillsApi.disable(skill.id, agentName).catch(error => {
          console.error('Failed to disable skill:', error);
        });
      } else {
        console.log(`Enabling skill ${skill.name} for agent ${agentName}`);
        skillsApi.enable(skill.id, agentName).catch(error => {
          console.error('Failed to enable skill:', error);
        });
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  }, [setSkills]);

  const handleDeleteSkill = useCallback(async (skill: SkillMetadata) => {
    try {
      if (skill.source !== 'global') {
        showToast('warning', '只能删除 Skills Manager 根目录中的技能');
        return;
      }

      await skillsApi.delete(skill.id);
      setSkills(prevSkills => prevSkills.filter(s => !(s.id === skill.id && s.source === 'global')));
      showToast('success', `技能 "${skill.name}" 已删除`);
      console.log(`Skill ${skill.name} deleted`);
    } catch (error) {
      console.error('Failed to delete skill:', error);
      showToast('error', '删除技能失败');
    }
  }, [setSkills, showToast]);

  const handleAddToRoot = useCallback(async (skill: SkillMetadata) => {
    try {
      if (!skill.path) {
        showToast('error', '无法获取技能路径');
        return;
      }
      await skillsApi.importFolder(skill.path);
      showToast('success', `技能 "${skill.name}" 已拷贝到根目录`);
    } catch (error) {
      const msg = typeof error === 'string' ? error : (error as Error)?.message || '拷贝到根目录失败';
      showToast('error', msg);
    }
  }, [showToast]);

  return {
    handleToggleSkill,
    handleToggleAgent,
    handleDeleteSkill,
    handleAddToRoot,
  };
};
