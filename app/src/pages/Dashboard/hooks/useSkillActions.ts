import { useCallback } from 'react';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import type { SkillMetadata, MergedSkillInfo } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';

const matchSkill = (s: SkillMetadata, skill: SkillMetadata) =>
  s.id === skill.id && s.source === skill.source;

export const useSkillActions = (
  _skills: SkillMetadata[],
  setSkills: React.Dispatch<React.SetStateAction<SkillMetadata[]>>
) => {
  const { showToast } = useToast();

  const handleToggleSkill = useCallback(async (skill: SkillMetadata) => {
    try {
      const newState = !skill.enabled;

      if (newState === false) {
        console.log('Turning off main switch, backing up config and disabling all sub-switches');

        const agentsToDisable = Object.keys(skill.agent_enabled || {}).filter(
          agent => skill.agent_enabled[agent] === true
        );

        setSkills(prevSkills =>
          prevSkills.map(s =>
            matchSkill(s, skill)
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

        agentsToDisable.forEach(agent => {
          skillsApi.disable(skill.id, agent, skill.source).catch(error => {
            console.error(`Failed to disable ${skill.id} for agent ${agent}:`, error);
          });
        });
      } else {
        console.log('Turning on main switch, restoring previous config');

        const agentStatesToRestore = skill.agent_enabled_backup || skill.agent_enabled || {};
        const agentsToEnable = Object.keys(agentStatesToRestore).filter(
          agent => agentStatesToRestore[agent] === true
        );

        setSkills(prevSkills =>
          prevSkills.map(s =>
            matchSkill(s, skill)
              ? {
                  ...s,
                  enabled: true,
                  agent_enabled: agentStatesToRestore,
                  agent_enabled_backup: undefined
                }
              : s
          )
        );

        agentsToEnable.forEach(agent => {
          skillsApi.enable(skill.id, agent, skill.source).catch(error => {
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

      setSkills(prevSkills =>
        prevSkills.map(s =>
          matchSkill(s, skill)
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

      if (isEnabled) {
        console.log(`Disabling skill ${skill.name} for agent ${agentName}`);
        skillsApi.disable(skill.id, agentName, skill.source).catch(error => {
          console.error('Failed to disable skill:', error);
        });
      } else {
        console.log(`Enabling skill ${skill.name} for agent ${agentName}`);
        skillsApi.enable(skill.id, agentName, skill.source).catch(error => {
          console.error('Failed to enable skill:', error);
        });
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  }, [setSkills]);

  /** 合并卡片：toggle 主开关 → 对所有 sourceSkills 执行 */
  const handleToggleSkillMerged = useCallback(async (merged: MergedSkillInfo) => {
    const newState = !merged.primary.enabled;
    for (const sourceSkill of merged.sourceSkills) {
      const adapted = { ...sourceSkill, enabled: merged.primary.enabled, agent_enabled: merged.primary.agent_enabled };
      await handleToggleSkill(adapted);
    }
    void newState;
  }, [handleToggleSkill]);

  /** 合并卡片：toggle 某个 agent → 找到正确的 sourceSkill 路由 */
  const handleToggleAgentMerged = useCallback(async (merged: MergedSkillInfo, agentName: string) => {
    if (merged.nativeAgents.has(agentName)) return;

    const sourceSkill = merged.sourceSkills.find(s => s.source === SOURCE.Global)
      || merged.sourceSkills[0];
    await handleToggleAgent(sourceSkill, agentName);
  }, [handleToggleAgent]);

  const handleDeleteSkill = useCallback(async (skill: SkillMetadata, silent = false) => {
    try {
      await skillsApi.delete(skill.id, skill.source);
      setSkills(prevSkills => prevSkills.filter(s => !matchSkill(s, skill)));
      if (!silent) showToast('success', `技能 "${skill.name}" 已删除`);
      console.log(`Skill ${skill.name} deleted`);
    } catch (error) {
      console.error('Failed to delete skill:', error);
      if (!silent) showToast('error', '删除技能失败');
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
    handleToggleSkillMerged,
    handleToggleAgentMerged,
    handleDeleteSkill,
    handleAddToRoot,
  };
};
