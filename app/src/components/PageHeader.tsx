interface PageHeaderProps {
  icon: string;
  title: string;
  actions?: React.ReactNode;
}

const defaultActions = (
  <></>
);

export default function PageHeader({ icon, title, actions = defaultActions }: PageHeaderProps) {
  return (
    <header
      className="h-16 flex-shrink-0 bg-white/80 dark:bg-dark-bg-card/80 backdrop-blur-md flex justify-between items-center px-8 border-b border-[#edeeef] dark:border-dark-border"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-2xl text-slate-900 dark:text-white">{icon}</span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        {actions}
      </div>
    </header>
  );
}
