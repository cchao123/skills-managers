interface LinkingStrategySectionProps {
  currentStrategy: 'Symlink' | 'Copy';
  onStrategyChange: (strategy: 'Symlink' | 'Copy') => void;
}

export const LinkingStrategySection: React.FC<LinkingStrategySectionProps> = ({
  currentStrategy,
  onStrategyChange,
}) => {
  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Linking Strategy
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Choose how skills are linked to agent directories
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors">
            <input
              type="radio"
              name="linking-strategy"
              checked={currentStrategy === 'Symlink'}
              onChange={() => onStrategyChange('Symlink')}
              className="w-4 h-4 text-red-600"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-white">Symlink (Recommended)</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Create symbolic links - faster and uses less disk space
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-dark-border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary transition-colors">
            <input
              type="radio"
              name="linking-strategy"
              checked={currentStrategy === 'Copy'}
              onChange={() => onStrategyChange('Copy')}
              className="w-4 h-4 text-red-600"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-white">Copy</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Copy files - slower but works without permissions
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
