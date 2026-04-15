import { useTranslation } from 'react-i18next';

interface StarButtonProps {
  starred: boolean;
  starring: boolean;
  hasToken?: boolean;
  onStar: () => void;
}

export const StarButton = ({
  starred,
  starring,
  onStar,
}: StarButtonProps) => {
  const { t } = useTranslation();
  return (
    <button
      onClick={onStar}
      disabled={starred || starring}
      className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
    >
      <span
        className="material-symbols-outlined text-lg text-yellow-400"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {starring ? 'hourglass_top' : 'star'}
      </span>
      <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
        {starred ? t('githubBackup.star.starred') : t('githubBackup.star.star')}
      </span>
    </button>
  );
};
