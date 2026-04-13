interface EmptyViewProps {
  message: string;
}

export const EmptyView: React.FC<EmptyViewProps> = ({ message }) => {
  return (
    <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
      <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
        search_off
      </span>
      <p className="text-slate-500 dark:text-gray-400 font-medium">
        {message}
      </p>
    </div>
  );
};
