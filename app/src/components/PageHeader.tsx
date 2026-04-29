import { Icon } from '@/components/Icon';
interface PageHeaderProps {
  icon: string;
  title?: string;
  leftAccessory?: React.ReactNode;
  center?: React.ReactNode;
  actions?: React.ReactNode;
}

const defaultSlots = (
  <></>
);

export default function PageHeader({ icon, title, leftAccessory, center = defaultSlots, actions = defaultSlots }: PageHeaderProps) {
  return (
    <header
      className="relative z-30 h-16 flex-shrink-0 overflow-visible bg-white/80 dark:bg-dark-bg-card/80 backdrop-blur-md flex justify-between items-center px-8 border-b border-[#edeeef] dark:border-dark-border"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-4">
        <Icon name={icon} className="text-2xl text-slate-900 dark:text-white" />
        {title && (
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        )}
        {leftAccessory}
      </div>
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {center}
      </div>
      <div className="flex items-center gap-4">
        {actions}
      </div>
    </header>
  );
}
