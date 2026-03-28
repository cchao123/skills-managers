import { AgentCard } from '../../../components/AgentCard';
import type { AgentConfig } from '../../../types';

interface AgentsSectionProps {
  agents: AgentConfig[];
  onDetectAgents: () => void;
}

export const AgentsSection: React.FC<AgentsSectionProps> = ({
  agents,
  onDetectAgents,
}) => {
  return (
    <div className="space-y-6">
      {/* Agent Management Section */}
      <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Agent Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage AI coding assistants for skill integration
          </p>
        </div>

        <div className="p-6 space-y-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              onToggle={() => console.log('Toggle agent:', agent.name)}
            />
          ))}

          <button
            onClick={onDetectAgents}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">search</span>
            Detect All Agents
          </button>
        </div>
      </div>
    </div>
  );
};
