import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { PROJECT_NAME, PROJECT_VERSION, PAGE, SESSION_STORAGE_KEYS, WINDOW_EVENTS, pageToPath, type Page } from '@/constants';

interface SideNavBarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function SideNavBar({ isCollapsed, onToggleCollapse }: SideNavBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.settingsInitialTab, 'about');
    } catch {
      /* ignore quota / private mode */
    }
    // 已经在 Settings 页时，navigate 不会触发重新挂载，需要一个事件通知已 mount 的 Settings 切 tab
    window.dispatchEvent(new CustomEvent(WINDOW_EVENTS.settingsSetTab, { detail: 'about' }));
    navigate(pageToPath(PAGE.Settings));
  };

  const navButtonClass = (active: boolean, collapsed: boolean) =>
    `flex items-center gap-3 py-3 rounded-lg font-bold transition-all active:scale-95 w-full ${
      collapsed ? 'justify-center px-0' : 'px-4'
    } ${
      active
        ? 'text-[#b71422] bg-white dark:bg-dark-bg-card shadow-sm dark:shadow-none'
        : 'text-slate-600 dark:text-gray-300 hover:text-[#b71422] hover:bg-white/50 dark:hover:bg-dark-bg-tertiary'
    }`;

  const navItems: Array<{ id: Page; icon: string; label: string }> = [
    { id: PAGE.Dashboard, icon: 'extension', label: t('nav.dashboard') },
    { id: PAGE.GitHubBackup, icon: 'backup', label: t('nav.githubBackup') },
  ];

  const settingsItem: { id: Page; icon: string; label: string } = {
    id: PAGE.Settings,
    icon: 'settings',
    label: t('nav.settings'),
  };

  return (
    <aside
      className={`h-screen fixed left-0 top-0 bg-[#edeeef] dark:bg-dark-bg-secondary flex flex-col pt-14 pb-8 z-50 border-r border-[#e1e3e4] dark:border-dark-border ${
        isCollapsed ? 'w-20 px-2' : 'w-64 px-4'
      }`}
    >
      {/* Drag region for window movement */}
      <div
        className="absolute top-0 left-0 right-0 h-14"
        data-tauri-drag-region
      />
      <AppInfo
        isCollapsed={isCollapsed}
        onClick={handleLogoClick}
        title={t('settings.tabAbout')}
      />

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={pageToPath(item.id)}
            end={item.id === PAGE.Dashboard}
            className={({ isActive }) => navButtonClass(isActive, isCollapsed)}
            title={isCollapsed ? item.label : ''}
          >
            <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
            {!isCollapsed && <span className="font-['Manrope'] dark:text-gray-300">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Settings at the bottom */}
      <NavLink
        to={pageToPath(settingsItem.id)}
        className={({ isActive }) => navButtonClass(isActive, isCollapsed)}
        title={isCollapsed ? settingsItem.label : ''}
      >
        <span className="material-symbols-outlined" data-icon={settingsItem.icon}>{settingsItem.icon}</span>
        {!isCollapsed && <span className="font-['Manrope'] dark:text-gray-300">{settingsItem.label}</span>}
      </NavLink>

      {/* Collapse Toggle Button - Fixed on the right edge */}
      <button
        onClick={onToggleCollapse}
        className="fixed top-1/2 -translate-y-1/2 w-4 h-10 rounded-lg bg-white dark:bg-dark-bg-card shadow-md flex items-center justify-center z-50"
        style={{
          left: isCollapsed ? '80px' : '256px',
          transform: 'translate(-50%, -50%)',
          boxShadow: '1px 1px 1px rgba(0, 0, 0, 0.1)',
        }}
        title={isCollapsed ? t('nav.expand') : t('nav.collapse')}
      >
        <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-xl">
          {isCollapsed ? 'chevron_right' : 'chevron_left'}
        </span>
      </button>
    </aside>
  );
}

interface AppInfoProps {
  isCollapsed: boolean;
  onClick: () => void;
  title: string;
}

function AppInfo({ isCollapsed, onClick, title }: AppInfoProps) {
  if (isCollapsed) {
    return (
      <div className="flex justify-center mb-12">
        <button
          type="button"
          onClick={onClick}
          title={title}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white dark:bg-dark-bg-card hover:opacity-80 active:scale-[0.98] transition-all cursor-pointer"
        >
          <img src="/octopus-logo.png" alt="Octopus Logo" className="w-full h-full object-cover" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-3 mb-12 px-2 text-left hover:opacity-80 active:scale-[0.98] transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white dark:bg-dark-tertiary">
        <img src="/octopus-logo.png" alt="Octopus Logo" className="w-full h-full object-cover" />
      </div>
      <div>
        <h1 className="text-xl font-black text-[#b71422] font-['Manrope'] tracking-tight">
          {PROJECT_NAME}
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 font-bold">
          {PROJECT_VERSION}
        </p>
      </div>
    </button>
  );
}