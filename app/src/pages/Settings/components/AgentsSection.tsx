import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';
import { agentsApi } from '@/api/tauri';
import type { AgentConfig } from '@/types';
import { getAgentScanPaths } from '@/pages/Settings/constants/agentScanPaths';
import { KNOWN_AGENTS, LOCAL_STORAGE_KEYS } from '@/constants';
import { readHiddenAgents } from '@/hooks/useHiddenAgents';
import { sortAgentsByStoredOrder, saveAgentsOrder } from '@/lib/agentOrder';
import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { Icon } from '@/components/Icon';

interface AgentsSectionProps {
  agents: AgentConfig[];
}

interface CtxState {
  open: boolean;
  x: number;
  y: number;
  path: string | null;
}


// ---------- 单行可排序子组件 ----------
interface SortableAgentRowProps {
  agent: (typeof KNOWN_AGENTS)[number];
  detected: boolean;
  isExpanded: boolean;
  canExpand: boolean;
  scanPaths: string[];
  onToggleExpand: () => void;
  onOpenPath: (path: string) => void;
  onContextMenu: (path: string) => (e: React.MouseEvent) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const SortableAgentRow: React.FC<SortableAgentRowProps> = ({
  agent, detected, isExpanded, canExpand, scanPaths,
  onToggleExpand, onOpenPath, onContextMenu, t,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: agent.name,
    disabled: !detected,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="w-full flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors"
        onContextMenu={detected ? onContextMenu(agent.rootPath) : undefined}
      >
        {/* 拖拽把手 */}
        <div
          {...(detected ? attributes : {})}
          {...(detected ? listeners : {})}
          className={`pl-3 flex items-center self-stretch touch-none ${
            detected
              ? 'cursor-grab active:cursor-grabbing text-slate-300 dark:text-gray-600 hover:text-slate-400 dark:hover:text-gray-500'
              : 'cursor-not-allowed text-slate-200 dark:text-gray-700'
          }`}
        >
          <Icon name="drag_indicator" className="text-lg" />
        </div>

        <button
          type="button"
          onClick={() => canExpand ? onToggleExpand() : onOpenPath(agent.rootPath)}
          disabled={!detected}
          aria-expanded={canExpand ? isExpanded : undefined}
          className="flex-1 min-w-0 pl-2 pr-2 py-4 flex items-center gap-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={getAgentIcon(agent.name)}
              alt={agent.displayName}
              className={`w-6 h-6 object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {agent.displayName}
              </span>
              {detected ? (
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold rounded-full">
                  {t('settings.agents.installed')}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-500 dark:text-gray-500 text-[10px] font-semibold rounded-full">
                  {t('settings.agents.notInstalled')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 font-mono truncate">
              {agent.rootPath}
            </p>
          </div>
        </button>

        {canExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('settings.agents.collapse') : t('settings.agents.expand')}
            title={isExpanded ? t('settings.agents.collapse') : t('settings.agents.expand')}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 dark:text-gray-500 hover:bg-white dark:hover:bg-dark-bg-card hover:text-[#b71422] transition-colors"
          >
            <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-lg" />
          </button>
        )}

        {detected && (
          <button
            type="button"
            onClick={() => onOpenPath(agent.rootPath)}
            aria-label={agent.rootPath}
            title={agent.rootPath}
            className="shrink-0 w-8 h-8 mr-4 rounded-md flex items-center justify-center text-slate-300 dark:text-gray-600 hover:bg-white dark:hover:bg-dark-bg-card hover:text-[#b71422] transition-colors"
          >
            <Icon name="open_in_new" className="text-lg" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="px-6 pb-4 pt-1 bg-slate-50/50 dark:bg-dark-bg-tertiary/40">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 mb-2 pl-[52px] uppercase tracking-wide">
            {t('settings.agents.scanPaths')}
          </p>
          <ul className="space-y-1 pl-[52px]">
            {scanPaths.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onOpenPath(p)}
                  onContextMenu={onContextMenu(p)}
                  title={p}
                  className="group w-full flex items-center gap-2 py-1 px-2 -ml-2 rounded-md hover:bg-white dark:hover:bg-dark-bg-card transition-colors text-left"
                >
                  <Icon name="subdirectory_arrow_right" className="text-sm text-slate-400 dark:text-gray-500 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs font-mono text-slate-600 dark:text-gray-300 truncate group-hover:text-[#b71422]">
                    {p}
                  </span>
                  <Icon name="open_in_new" className="text-sm text-slate-300 dark:text-gray-600 group-hover:text-[#b71422] shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ---------- 主组件 ----------
export const AgentsSection: React.FC<AgentsSectionProps> = ({ agents }) => {
  const { t } = useTranslation();
  const detectedSet = useMemo(
    () => new Set(agents.filter(a => a.detected).map(a => a.name)),
    [agents],
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [orderedAgents, setOrderedAgents] = useState(() => sortAgentsByStoredOrder([...KNOWN_AGENTS]));
  const [hiddenAgentNames, setHiddenAgentNames] = useState<Set<string>>(readHiddenAgents);
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const visibleOrderedAgents = useMemo(() => {
    const detected: typeof orderedAgents = [];
    const undetected: typeof orderedAgents = [];
    for (const a of orderedAgents) {
      if (hiddenAgentNames.has(a.name)) continue;
      (detectedSet.has(a.name) ? detected : undetected).push(a);
    }
    return [...detected, ...undetected];
  }, [orderedAgents, hiddenAgentNames, detectedSet]);

  const openManage = () => {
    setDraft(new Set(hiddenAgentNames));
    setManageOpen(true);
  };

  const toggleDraft = (name: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirmManage = () => {
    setHiddenAgentNames(draft);
    try {
      const value = JSON.stringify([...draft]);
      localStorage.setItem(LOCAL_STORAGE_KEYS.hiddenAgents, value);
      window.dispatchEvent(new StorageEvent('storage', {
        key: LOCAL_STORAGE_KEYS.hiddenAgents,
        newValue: value,
      }));
    } catch { /* ignore */ }
    setManageOpen(false);
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedAgents(prev => {
      const oldIndex = prev.findIndex(a => a.name === active.id);
      const newIndex = prev.findIndex(a => a.name === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      saveAgentsOrder(next.map(a => a.name));
      return next;
    });
  };

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleOpenPath = (path: string) => {
    agentsApi.openFolderPath(path).catch(() => { });
  };

  const [ctxMenu, setCtxMenu] = useState<CtxState>({ open: false, x: 0, y: 0, path: null });
  const closeCtxMenu = () => setCtxMenu(s => ({ ...s, open: false }));
  const openCtxMenu = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, path });
  };
  const ctxItems: ContextMenuItem[] = ctxMenu.path
    ? [{
        label: t('dashboard.contextMenu.openRoot'),
        icon: 'folder_open',
        onClick: () => { if (ctxMenu.path) handleOpenPath(ctxMenu.path); },
      }]
    : [];

  return (
    <div className="space-y-6">
      {/* Skills Manager card */}
      <button
        type="button"
        onClick={() => agentsApi.openFolder().catch(() => { })}
        onContextMenu={openCtxMenu('~/.skills-manager')}
        className="w-full bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border px-6 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-dark-bg-tertiary transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center shrink-0 overflow-hidden">
          <img src={OCTOPUS_LOGO_URL} alt="Skills Manager" className="w-5 h-5 object-contain" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-white shrink-0">
            {t('settings.agents.skillsManager')}
          </span>
          <p className="text-xs text-slate-400 dark:text-gray-500 font-mono truncate">
            ~/.skills-manager
          </p>
          <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-semibold rounded-full shrink-0">
            {t('settings.agents.appRoot')}
          </span>
        </div>
        <Icon name="open_in_new" className="text-lg text-slate-300 dark:text-gray-600 shrink-0" />
      </button>

      {/* Agents card */}
      <div className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Icon name="smart_toy" className="text-2xl text-slate-600 dark:text-gray-300" />
              {t('settings.agents.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              {t('settings.agents.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={openManage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e1e3e4] dark:border-dark-border bg-white dark:bg-dark-bg-card hover:border-[#b71422]/40 hover:text-[#b71422] text-slate-500 dark:text-gray-400 text-sm font-medium transition-colors shrink-0"
          >
            <Icon name="tune" className="text-base" />
            {hiddenAgentNames.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#b71422] text-white text-[10px] font-bold flex items-center justify-center">
                {hiddenAgentNames.size}
              </span>
            )}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleOrderedAgents.map(a => a.name)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-[#e1e3e4] dark:divide-dark-border">
              {visibleOrderedAgents.map(agent => {
                const detected = detectedSet.has(agent.name);
                const scanPaths = getAgentScanPaths(agent.name);
                return (
                  <SortableAgentRow
                    key={agent.name}
                    agent={agent}
                    detected={detected}
                    isExpanded={expanded.has(agent.name)}
                    canExpand={detected && scanPaths.length > 0}
                    scanPaths={scanPaths}
                    onToggleExpand={() => toggleExpand(agent.name)}
                    onOpenPath={handleOpenPath}
                    onContextMenu={openCtxMenu}
                    t={t}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={ctxItems}
        onClose={closeCtxMenu}
      />

      {/* Manage Agents Modal */}
      {manageOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
          onClick={() => setManageOpen(false)}
        >
          <div
            className="bg-white dark:bg-dark-bg-card rounded-2xl border border-[#e1e3e4] dark:border-dark-border shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e1e3e4] dark:border-dark-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('settings.agents.manageTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  {t('settings.agents.manageSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Agent grid */}
            <div className="p-4 grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
              {KNOWN_AGENTS.map(agent => {
                const isVisible = !draft.has(agent.name);
                return (
                  <button
                    key={agent.name}
                    type="button"
                    onClick={() => toggleDraft(agent.name)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isVisible
                        ? 'border-[#b71422] bg-rose-50 dark:bg-rose-900/10'
                        : 'border-[#e1e3e4] dark:border-dark-border bg-white dark:bg-dark-bg-card hover:border-slate-300 dark:hover:border-gray-500'
                    }`}
                  >
                    {isVisible && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#b71422] flex items-center justify-center">
                        <Icon name="check" className="text-white text-[11px]" />
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-bg-tertiary flex items-center justify-center overflow-hidden">
                      <img
                        src={agent.icon}
                        alt={agent.displayName}
                        className={`w-6 h-6 object-contain ${needsInvertInDark(agent.name) ? 'dark:invert' : ''}`}
                      />
                    </div>
                    <span className={`text-xs font-semibold text-center leading-tight ${
                      isVisible ? 'text-[#b71422] dark:text-rose-400' : 'text-slate-700 dark:text-gray-200'
                    }`}>
                      {agent.displayName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e1e3e4] dark:border-dark-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-dark-bg-tertiary transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmManage}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-[#b71422] text-white hover:opacity-90 transition-opacity"
              >
                {t('settings.agents.manageConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
