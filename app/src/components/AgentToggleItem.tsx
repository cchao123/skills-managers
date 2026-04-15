import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from 'react-material-symbols';
import type { AgentConfig } from '@/types';

interface AgentToggleItemProps {
  agent: AgentConfig;
  is_enabled: boolean;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Reusable component for per-agent skill enable/disable toggles
 * Shows detection status and allows toggling if agent is installed
 */
export const AgentToggleItem: React.FC<AgentToggleItemProps> = ({
  agent,
  is_enabled,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-2.5 bg-[#f9fafb] dark:bg-dark-bg-secondary rounded-lg">
      <div className="flex items-center gap-2">
        {/* Detection Status Icon */}
        <div
          className={`w-6 h-6 rounded flex items-center justify-center ${
            agent.detected
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-gray-200 dark:bg-dark-bg-tertiary'
          }`}
        >
          <MaterialSymbol
            icon={agent.detected ? 'check_circle' : 'help'}
            className={`text-sm ${
              agent.detected
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />
        </div>

        {/* Agent Name */}
        <span className="text-sm text-gray-700 dark:text-gray-200">
          {agent.display_name}
        </span>

        {/* Not Detected Label */}
        {!agent.detected && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({t('common.notInstalled')})
          </span>
        )}
      </div>

      {/* Toggle Switch */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(e);
        }}
        disabled={!agent.detected}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          is_enabled ? 'bg-[#dc2626]' : 'bg-gray-300 dark:bg-gray-600'
        } ${
          !agent.detected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        aria-label={`Toggle ${agent.display_name}`}
        type="button"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            is_enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
