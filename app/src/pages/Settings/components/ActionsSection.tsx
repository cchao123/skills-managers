interface ActionsSectionProps {
  onOpenFolder: () => void;
}

export const ActionsSection: React.FC<ActionsSectionProps> = ({
  onOpenFolder,
}) => {
  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Actions
        </h2>
      </div>

      <div className="p-6">
        <button
          onClick={onOpenFolder}
          className="w-full bg-gray-100 dark:bg-dark-bg-tertiary hover:bg-gray-200 dark:hover:bg-dark-bg-quaternary text-gray-900 dark:text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">folder_open</span>
          Open Skills Folder
        </button>
      </div>
    </div>
  );
};
