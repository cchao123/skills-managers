import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import { SOURCE } from '@/pages/Dashboard/utils/source';

import { Icon } from '@/components/Icon';

interface PlusCardProps {
  agents: AgentConfig[];
  currentAgent: string;
  onOpen: () => void;
}

export const PlusCard: React.FC<PlusCardProps> = ({ agents, currentAgent, onOpen }) => {
  const { t } = useTranslation();

  // 获取目标名称
  const getTargetName = () => {
    if (currentAgent === SOURCE.Global) {
      return t('dashboard.source.global');
    }
    const agent = agents.find(a => a.name === currentAgent);
    return agent ? agent.display_name : currentAgent;
  };

  return (
    <div
      onClick={onOpen}
      className="bg-white dark:bg-dark-bg-card rounded-xl border border-dashed border-2 border-slate-300 dark:border-dark-border hover:border-[#b71422]/60 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-all cursor-pointer p-4"
    >
      <div className="flex flex-col items-center gap-3">
        {/* 加号图标 */}
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-bg-tertiary border-2 border-slate-300 dark:border-dark-border flex items-center justify-center hover:border-[#b71422]/60 hover:bg-white dark:hover:bg-dark-bg-card transition-all shadow-sm flex-shrink-0">
          <Icon name="add" className="text-sm text-slate-400 dark:text-gray-500 hover:text-[#b71422] transition-colors" />
        </div>

        {/* 文字说明 */}
        <div className="text-center">
          <p className="text-xs font-medium text-slate-600 dark:text-gray-300 hover:text-[#b71422] transition-colors">
            {t('dashboard.import.fromOther')} {getTargetName()}
          </p>
        </div>
      </div>
    </div>
  );
};

