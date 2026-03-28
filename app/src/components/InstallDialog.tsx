import { useState } from 'react';
import type { GitHubSkill, AgentConfig } from '../types';

interface InstallDialogProps {
  skill: GitHubSkill;
  agents: AgentConfig[];
  onConfirm: (selectedAgents: string[]) => void;
  onClose: () => void;
}

export default function InstallDialog({ skill, agents, onConfirm, onClose }: InstallDialogProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());

  const toggleAgent = (agentName: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentName)) {
      newSelected.delete(agentName);
    } else {
      newSelected.add(agentName);
    }
    setSelectedAgents(newSelected);
  };

  const handleConfirm = () => {
    if (selectedAgents.size === 0) {
      alert('请至少选择一个 Agent');
      return;
    }
    onConfirm(Array.from(selectedAgents));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-bg-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          安装技能: {skill.name}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          选择要启用此技能的 Agent：
        </p>

        <div className="space-y-2 mb-6">
          {agents.filter(a => a.enabled).map((agent) => (
            <label
              key={agent.name}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedAgents.has(agent.name)}
                onChange={() => toggleAgent(agent.name)}
                className="w-5 h-5 text-[#dc2626] rounded focus:ring-[#dc2626]"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{agent.display_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.detected ? '✓ 已检测' : '未安装'}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#e1e3e4] dark:border-dark-border rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg text-sm font-bold text-white"
          >
            确认安装
          </button>
        </div>
      </div>
    </div>
  );
}
