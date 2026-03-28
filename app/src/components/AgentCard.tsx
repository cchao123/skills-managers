import { MaterialSymbol } from 'react-material-symbols';
import type { AgentConfig } from '../types';

interface AgentCardProps {
  agent: AgentConfig;
  onToggle: () => void;
}

/**
 * Display agent information and configuration in Settings page
 * Shows detection status, path, and enable/disable toggle
 */
export const AgentCard: React.FC<AgentCardProps> = ({ agent, onToggle }) => {
  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-lg p-4 border border-gray-200 dark:border-dark-border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Agent Name + Detection Status Badge */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {agent.display_name}
            </h3>

            {/* Detection Status Badge */}
            {agent.detected ? (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                <MaterialSymbol icon="check_circle" className="text-sm" />
                Detected
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 dark:bg-dark-bg-tertiary text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full flex items-center gap-1">
                <MaterialSymbol icon="help" className="text-sm" />
                Not Detected
              </span>
            )}
          </div>

          {/* Path Information */}
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            <code className="bg-gray-100 dark:bg-dark-bg-tertiary px-2 py-1 rounded">
              {agent.path} → {agent.skills_path}
            </code>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {agent.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={onToggle}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                agent.enabled
                  ? 'bg-[#dc2626]'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Toggle ${agent.display_name}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  agent.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
