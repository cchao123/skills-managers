import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { TelemetryEvent } from '@/constants/events';
import { trackEvent } from '@/lib/telemetry';
import type { SkillMetadata, AgentConfig } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';
import { appendOperationLog } from '@/pages/Dashboard/hooks/useOperationLog';

// Schema v2：同一 skill_id 只有一条记录，直接按 id 比对
const matchSkill = (s: SkillMetadata, skill: SkillMetadata) => s.id === skill.id;

export const useSkillActions = (
  _skills: SkillMetadata[],
  setSkills: React.Dispatch<React.SetStateAction<SkillMetadata[]>>,
  agents: AgentConfig[] = []
) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  // 获取所有可用的 agent 名称
  const availableAgents = agents
    .filter(agent => agent.detected && agent.enabled)
    .map(agent => agent.name);

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
        skillsApi.disable(skill.id, agentName).then(() => {
          trackEvent(TelemetryEvent.SKILL_AGENT_DISABLED, { skill_id: skill.id, agent: agentName });
        }).catch(error => {
          console.error('Failed to disable skill:', error);
        });
      } else {
        console.log(`Enabling skill ${skill.name} for agent ${agentName}`);
        // 已在根目录的 skill 再启用其它 agent，仅建链接不会产生"新拷入根目录"的动作，不记日志
        const alreadyInRoot = (skill.sources ?? []).includes(SOURCE.Global);
        skillsApi.enable(skill.id, agentName).then(() => {
          trackEvent(TelemetryEvent.SKILL_AGENT_ENABLED, { skill_id: skill.id, agent: agentName });
          if (!alreadyInRoot) {
            appendOperationLog({
              type: 'enableAgent',
              skillName: skill.name,
              targetAgent: agentName,
              source: skill.primary,
            });
          }
        }).catch(error => {
          console.error('Failed to enable skill:', error);
        });
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  }, [setSkills]);

  /**
   * 合并卡片主开关（三态视觉：off / partial / on）。
   *
   * 行为约定：
   * - native agent（sources 中的非 global 项）的 agent_enabled 由物理副本派生，不在本开关作用范围内。
   * - 只批量切换 availableAgents 中「非 native」的部分：
   *   - 若所有非 native agent 均已启用 → 一键关闭（native 保持启用）
   *   - 否则 → 一键启用所有非 native agent
   * - 当所有可用 agent 都是 native（没有可切换对象）时点击无效。
   */
  const handleToggleSkillMerged = useCallback(async (skill: SkillMetadata) => {
    const nativeSet = new Set((skill.sources ?? []).filter(s => s !== SOURCE.Global));
    const togglableAgents = availableAgents.filter(name => !nativeSet.has(name));
    if (togglableAgents.length === 0) return;

    const allTogglableOn = togglableAgents.every(name => skill.agent_enabled[name]);
    const shouldEnable = !allTogglableOn;

    setSkills(prevSkills =>
      prevSkills.map(s => {
        if (!matchSkill(s, skill)) return s;
        const nextAgentEnabled = { ...(s.agent_enabled ?? {}) };
        togglableAgents.forEach(name => { nextAgentEnabled[name] = shouldEnable; });
        const anyOn = nativeSet.size > 0 || Object.values(nextAgentEnabled).some(Boolean);
        return { ...s, agent_enabled: nextAgentEnabled, enabled: anyOn };
      })
    );

    const alreadyInRoot = (skill.sources ?? []).includes(SOURCE.Global);
    togglableAgents.forEach(agent => {
      const op = shouldEnable
        ? skillsApi.enable(skill.id, agent)
        : skillsApi.disable(skill.id, agent);
      op.then(() => {
        trackEvent(
          shouldEnable ? TelemetryEvent.SKILL_ENABLED : TelemetryEvent.SKILL_DISABLED,
          { skill_id: skill.id, agent },
        );
        if (shouldEnable && !alreadyInRoot) {
          appendOperationLog({
            type: 'enableAgent',
            skillName: skill.name,
            targetAgent: agent,
            source: skill.primary,
          });
        }
      }).catch(err => {
        console.error(`Failed to ${shouldEnable ? 'enable' : 'disable'} ${skill.id}/${agent}:`, err);
      });
    });
  }, [setSkills, availableAgents]);

  /** 合并卡片：toggle 某个 agent（原生 agent 禁止关闭） */
  const handleToggleAgentMerged = useCallback(async (skill: SkillMetadata, agentName: string) => {
    if ((skill.sources ?? []).includes(agentName)) {
      showToast('warning', t('dashboard.toast.nativeAgentWarning', { agent: agentName }));
      return;
    }

    await handleToggleAgent(skill, agentName);
  }, [handleToggleAgent, showToast, t]);

  /**
   * 删除指定源或整个技能。
   * - `source` 显式指定要删的源（由 Dashboard 从 `SkillDeletionRow` 透传）；
   *   省略时表示删除所有源的物理副本。
   * - 本方法**不做**本地 `setSkills` 过滤：单源删除时整体记录可能仍在（还剩其它源），
   *   正确的状态由调用方在批量删除完成后的 `refreshSkills()` 统一拉回。
   */
  const handleDeleteSkill = useCallback(async (
    skill: SkillMetadata,
    source?: string,
    silent = false,
  ) => {
    try {
      await skillsApi.delete(skill.id, source);
      trackEvent(TelemetryEvent.SKILL_DELETED, { skill_id: skill.id, source: source || 'all' });
      if (!silent) showToast('success', t('dashboard.toast.skillDeleted', { name: skill.name }));
      console.log(`Skill ${skill.name} / source=${source ?? 'all'} deleted`);
    } catch (error) {
      console.error('Failed to delete skill:', error);
      if (!silent) showToast('error', t('dashboard.toast.skillDeleteFailed'));
    }
  }, [showToast, t]);

  /**
   * 把技能副本同步到中央仓库（root）。
   * - `sourcePath` 指定要拷贝的物理副本路径（从 `skill.source_paths[someSource]` 取得）。
   * - 缺失时回退到 primary 副本的路径。
   */
  const handleAddToRoot = useCallback(async (skill: SkillMetadata, sourcePath?: string) => {
    try {
      const pathToImport = sourcePath ?? skill.source_paths?.[skill.primary];
      if (!pathToImport) {
        console.error('[handleAddToRoot] 技能路径为空:', skill);
        showToast('error', t('dashboard.toast.cannotGetSkillPath'));
        return;
      }
      console.log('[handleAddToRoot] 开始拷贝技能:', skill.name, '路径:', pathToImport);
      await skillsApi.importFolder(pathToImport);
      showToast('success', t('dashboard.toast.skillCopiedToRoot', { name: skill.name }));
      console.log('[handleAddToRoot] 拷贝完成');
    } catch (error) {
      console.error('[handleAddToRoot] 拷贝失败:', error);
      const msg = typeof error === 'string' ? error : (error as Error)?.message || t('dashboard.toast.cannotGetSkillPath');
      showToast('error', msg);
    }
  }, [showToast, t]);

  return {
    handleToggleSkillMerged,
    handleToggleAgentMerged,
    handleDeleteSkill,
    handleAddToRoot,
  };
};
