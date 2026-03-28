interface StarButtonProps {
  starred: boolean;
  starring: boolean;
  /** 预留：父组件可据此决定是否展示或提示 */
  hasToken?: boolean;
  onStar: () => void;
}

export const StarButton = ({
  starred,
  starring,
  onStar,
}: StarButtonProps) => {
  return (
    <button
      onClick={onStar}
      disabled={starred || starring}
      className={`relative px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer overflow-hidden ${
        starred
          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 hover:scale-105'
          : 'bg-white dark:bg-dark-bg-card hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 dark:hover:from-dark-bg-tertiary dark:hover:to-dark-bg-quaternary text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-dark-border hover:shadow-md'
      }`}
    >
      {starred && (
        <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 opacity-100"></span>
      )}
      <span className="relative flex items-center gap-2">
        <span className={`material-symbols-outlined text-xl ${starred ? 'text-white' : ''}`} style={{ fontVariationSettings: starred ? "'FILL' 1" : "'FILL' 0" }}>
          {starring ? 'hourglass_top' : 'star'}
        </span>
        <span className={starred ? 'drop-shadow-sm' : ''}>
          {starred ? '已 Star' : 'Star'}
        </span>
      </span>
      {starred && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-dark-bg-card"></span>
      )}
    </button>
  );
};
