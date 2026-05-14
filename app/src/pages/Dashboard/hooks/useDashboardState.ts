import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkillMetadata } from '@/types';
import { pinApi } from '@/api/tauri';

/**
 * 管理 Dashboard 的核心状态
 */
export function useDashboardState() {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SkillMetadata | null>(null);
  const [deleteTargetFromRoot, setDeleteTargetFromRoot] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // 帮助气泡状态
  const [helpPopover, setHelpPopover] = useState<{ open: boolean; anchor: DOMRect | null }>({
    open: false,
    anchor: null,
  });
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  // 卡片右键上下文菜单状态
  const [cardContextMenu, setCardContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    skillId: string | null;
  }>({ open: false, x: 0, y: 0, skillId: null });

  // 置顶技能列表
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    pinApi
      .list()
      .then((ids) => {
        if (!cancelled) setPinnedIds(new Set(ids));
      })
      .catch(() => {
        // 在浏览器预览（非 Tauri）下静默失败即可
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardContextMenu = useCallback(
    (skillId: string, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      setCardContextMenu({ open: true, x: e.clientX, y: e.clientY, skillId });
    },
    []
  );

  const handleTogglePin = useCallback((skillId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      const willPin = !next.has(skillId);
      if (willPin) next.add(skillId);
      else next.delete(skillId);
      pinApi.setPinned(skillId, willPin).catch((err) => {
        console.error('[pin] failed:', err);
        setPinnedIds(prev);
      });
      return next;
    });
  }, []);

  // 操作日志 popover
  const [logPopoverAnchor, setLogPopoverAnchor] = useState<DOMRect | null>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);

  const handleLogClick = useCallback(() => {
    if (logPopoverAnchor) {
      setLogPopoverAnchor(null);
    } else {
      const rect = logButtonRef.current?.getBoundingClientRect();
      if (rect) setLogPopoverAnchor(rect);
    }
  }, [logPopoverAnchor]);

  return {
    // 状态
    expandedCards,
    setExpandedCards,
    deleteTarget,
    setDeleteTarget,
    deleteTargetFromRoot,
    setDeleteTargetFromRoot,
    showImportModal,
    setShowImportModal,
    helpPopover,
    setHelpPopover,
    helpButtonRef,
    cardContextMenu,
    setCardContextMenu,
    pinnedIds,
    logPopoverAnchor,
    setLogPopoverAnchor,
    logButtonRef,
    // Handlers
    handleCardContextMenu,
    handleTogglePin,
    handleLogClick,
  };
}
