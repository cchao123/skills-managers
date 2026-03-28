interface MarketHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
}

export default function MarketHeader({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories
}: MarketHeaderProps) {

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          search
        </span>
        <input
          type="text"
          placeholder="搜索技能名称、描述或分类..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border rounded-xl py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#b71422]/20 focus:border-[#b71422] transition-all shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* 分类过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-[#b71422] text-white font-bold'
                : 'bg-white dark:bg-dark-bg-card border border-[#e1e3e4] dark:border-dark-border text-[#5e5e5e] dark:text-gray-300 hover:bg-[#edeeef] dark:hover:bg-dark-bg-tertiary'
            }`}
          >
            {category === 'All' ? '全部' : category}
          </button>
        ))}
      </div>
    </div>
  );
}
