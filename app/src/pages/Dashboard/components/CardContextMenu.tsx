import { useTranslation } from 'react-i18next';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';

interface CardContextMenuProps {
  open: boolean;
  /** 鼠标点击位置（视口坐标） */
  x: number;
  y: number;
  onClose: () => void;
  /** 当前右键的卡片是否已被置顶 */
  pinned: boolean;
  /** 切换置顶状态 */
  onTogglePin: () => void;
}

/**
 * Skill 卡片上下文菜单：复用通用 ContextMenu 组件，仅装配卡片相关菜单项。
 */
export function CardContextMenu({
  open,
  x,
  y,
  onClose,
  pinned,
  onTogglePin,
}: CardContextMenuProps) {
  const { t } = useTranslation();

  const items: ContextMenuItem[] = [
    {
      label: pinned ? t('dashboard.contextMenu.unpinCard') : t('dashboard.contextMenu.pinCard'),
      icon: pinned ? 'keep_off' : 'keep',
      iconStyle: { fontVariationSettings: pinned ? "'FILL' 1" : undefined },
      onClick: onTogglePin,
    },
  ];

  return <ContextMenu open={open} x={x} y={y} items={items} onClose={onClose} />;
}

export default CardContextMenu;
