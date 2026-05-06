import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { PROJECT_NAME, PROJECT_VERSION, PAGE, SESSION_STORAGE_KEYS, WINDOW_EVENTS, pageToPath, type Page } from '@/constants';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';

import { Icon } from '@/components/Icon';
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

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl+';
  const navItems: Array<{ id: Page; icon: string; label: string; shortcut: string }> = [
    { id: PAGE.SkillDownload, icon: 'home', label: t('nav.skillDownload'), shortcut: `${mod}A` },
    { id: PAGE.Dashboard, icon: 'extension', label: t('nav.dashboard'), shortcut: `${mod}S` },
    { id: PAGE.GitHubBackup, icon: 'backup', label: t('nav.githubBackup'), shortcut: `${mod}D` },
  ];

  const settingsItem: { id: Page; icon: string; label: string } = {
    id: PAGE.Settings,
    icon: 'settings',
    label: t('nav.settings'),
  };

  return (
    <aside
      className={`h-screen bg-[#edeeef] dark:bg-dark-bg flex flex-col pt-14 pb-8 z-50 border-r border-[#e1e3e4] dark:border-dark-border shrink-0 relative ${
        isCollapsed ? 'w-20 px-3' : 'w-55 px-4'
      }`}
      data-tauri-drag-region
    >
      {/* 顶部拖动区域已被容器的 data-tauri-drag-region 覆盖 */}
      <AppInfo
        isCollapsed={isCollapsed}
        onClick={handleLogoClick}
        title={t('settings.tabAbout')}
      />

      <nav className="flex-1 space-y-2" data-tauri-drag-region>
        {navItems.map((item) => (
          <div key={item.id} className="relative group">
            <NavLink
              to={pageToPath(item.id)}
              end={item.id === PAGE.Dashboard}
              className={({ isActive }) => navButtonClass(isActive, isCollapsed)}
            >
              <Icon name={item.icon} data-icon={item.icon} className="text-xl" />
              {!isCollapsed && (
                <>
                  <span className="font-['Manrope'] dark:text-gray-300 flex-1">{item.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 tracking-tight">
                    {item.shortcut}
                  </span>
                </>
              )}
            </NavLink>
            <NavTooltip label={item.label} shortcut={item.shortcut} />
          </div>
        ))}
      </nav>

      {/* Settings at the bottom */}
      <div className="relative group">
        <NavLink
          to={pageToPath(settingsItem.id)}
          className={({ isActive }) => navButtonClass(isActive, isCollapsed)}
        >
          <Icon name={settingsItem.icon} data-icon={settingsItem.icon} className="text-xl" />
          {!isCollapsed && <span className="font-['Manrope'] dark:text-gray-300">{settingsItem.label}</span>}
        </NavLink>
        <NavTooltip label={settingsItem.label} />
      </div>

      {/* Collapse Toggle Button - Fixed on the right edge */}
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-10 rounded-lg bg-white dark:bg-dark-bg-card shadow-md flex items-center justify-center z-50 border border-transparent dark:border-dark-border"
        title={isCollapsed ? t('nav.expand') : t('nav.collapse')}
      >
        <Icon name={isCollapsed ? 'chevron_right' : 'chevron_left'} className="text-gray-400 dark:text-gray-500 text-xl" />
      </button>
    </aside>
  );
}

interface NavTooltipProps {
  label: string;
  shortcut?: string;
}

/** 侧栏导航 hover 黑色提示框，向右弹出。父级需要 `relative group`。 */
function NavTooltip({ label, shortcut }: NavTooltipProps) {
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[9999] pointer-events-none hidden group-hover:block">
      <div className="whitespace-nowrap rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-2.5 py-1 shadow-lg flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <span className="font-mono text-[11px] text-slate-300 dark:text-slate-400">{shortcut}</span>
        )}
      </div>
    </div>
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
          <img src={OCTOPUS_LOGO_URL} alt="Octopus Logo" className="w-full h-full object-cover" />
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
        <img src={OCTOPUS_LOGO_URL} alt="Octopus Logo" className="w-full h-full object-cover" />
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
