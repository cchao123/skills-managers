import { useState, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillHidePrefixes } from '@/hooks/useSkillHidePrefixes';

import { Icon } from '@/components/Icon';
/**
 * 按前缀隐藏技能的配置卡片：
 * - 用户在输入框敲入前缀（例如 `lark-`），回车或点击"添加"后生成 chip；
 * - 每个 chip 可单独删除；
 * - 持久化到 localStorage，Dashboard 实时响应。
 */
export const SkillFilterSection: React.FC = () => {
  const { t } = useTranslation();
  const { prefixes, addPrefix, removePrefix } = useSkillHidePrefixes();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    addPrefix(trimmed);
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && prefixes.length > 0) {
      // 输入框为空时按 Backspace：删除最后一个 chip，类似邮件收件人输入
      removePrefix(prefixes[prefixes.length - 1]);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon name="filter_alt_off" className="text-2xl text-slate-600 dark:text-gray-300" />
          {t('settings.skillFilter.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
          {t('settings.skillFilter.subtitle')}
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* 输入行 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="add" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('settings.skillFilter.placeholder')}
              className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-2.5 pl-12 pr-4 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[#b71422] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('settings.skillFilter.add')}
          </button>
        </div>

        {/* chip 列表 */}
        {prefixes.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-gray-500 italic">
            {t('settings.skillFilter.empty')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {prefixes.map((prefix) => (
              <span
                key={prefix}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono font-semibold"
              >
                {prefix}
                <button
                  type="button"
                  onClick={() => removePrefix(prefix)}
                  aria-label={t('settings.skillFilter.remove', { prefix })}
                  title={t('settings.skillFilter.remove', { prefix })}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                >
                  <Icon name="close" className="text-[12px]" />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-400 dark:text-gray-500 leading-relaxed">
          {t('settings.skillFilter.hint')}
        </p>
      </div>
    </div>
  );
};
