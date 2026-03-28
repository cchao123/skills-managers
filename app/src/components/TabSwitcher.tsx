import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabSwitcher: React.FC<TabSwitcherProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-bg-secondary rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-white dark:bg-dark-bg-card text-[#b71422] shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-300'
          }`}
        >
          {tab.icon && (
            <span className="material-symbols-outlined text-[18px]">
              {tab.icon}
            </span>
          )}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
