import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LIQUID_GLASS_TOAST_PANEL_CLASS } from '@/components/toastPanelStyles';
import type { AgentConfig, SkillMetadata, SkillDeletionRow } from '@/types';
import { DeleteConfirmModal } from '@/pages/Dashboard/components/DeleteConfirmModal';
import { SkillImportModal } from '@/pages/Dashboard/components/SkillImportModal';
import { OperationLogPopover } from '@/pages/Dashboard/components/OperationLogPopover';
import { CardContextMenu } from '@/pages/Dashboard/components/CardContextMenu';
import { Icon } from '@/components/Icon';
import { MainToggleIndicator, MAIN_TOGGLE_STATES } from '@/pages/Dashboard/components/MainToggleIndicator';

interface DashboardModalsProps {
  deleteTarget: SkillMetadata | null;
  deleteTargetFromRoot: boolean;
  expandToSourceRows: (skill: SkillMetadata | null) => SkillDeletionRow[];
  handleDeleteConfirm: (selected: SkillDeletionRow[]) => Promise<void>;
  setDeleteTarget: (skill: SkillMetadata | null) => void;
  setDeleteTargetFromRoot: (fromRoot: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  agents: AgentConfig[];
  selectedSource: string;
  skills: SkillMetadata[];
  filteredBySource: SkillMetadata[];
  handleImportSkills: (importedSkills: SkillMetadata[], defaultEnabled: boolean) => Promise<void>;
  logPopoverAnchor: DOMRect | null;
  setLogPopoverAnchor: (rect: DOMRect | null) => void;
  helpPopover: { open: boolean; anchor: DOMRect | null };
  setHelpPopover: (popover: { open: boolean; anchor: DOMRect | null }) => void;
  cardContextMenu: { open: boolean; x: number; y: number; skillId: string | null };
  setCardContextMenu: (menu: { open: boolean; x: number; y: number; skillId: string | null } | ((prev: { open: boolean; x: number; y: number; skillId: string | null }) => { open: boolean; x: number; y: number; skillId: string | null })) => void;
  pinnedIds: Set<string>;
  handleTogglePin: (skillId: string) => void;
}

export const DashboardModals: React.FC<DashboardModalsProps> = ({
  deleteTarget,
  deleteTargetFromRoot,
  expandToSourceRows,
  handleDeleteConfirm,
  setDeleteTarget,
  setDeleteTargetFromRoot,
  showImportModal,
  setShowImportModal,
  agents,
  selectedSource,
  skills,
  filteredBySource,
  handleImportSkills,
  logPopoverAnchor,
  setLogPopoverAnchor,
  helpPopover,
  setHelpPopover,
  cardContextMenu,
  setCardContextMenu,
  pinnedIds,
  handleTogglePin,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        target={deleteTarget}
        rows={
          deleteTarget && !deleteTargetFromRoot
            ? expandToSourceRows(deleteTarget)
            : undefined
        }
        purpose={deleteTargetFromRoot ? 'root-only' : 'multi-source'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteTargetFromRoot(false);
        }}
      />

      {/* Skill Import Modal */}
      {showImportModal && (
        <SkillImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          agents={agents}
          currentAgent={selectedSource}
          allSkills={skills}
          currentAgentSkills={filteredBySource}
          onImport={handleImportSkills}
        />
      )}

      {/* Help Popover */}
      {helpPopover.open &&
        helpPopover.anchor &&
        (() => {
          const rect = helpPopover.anchor as DOMRect;
          const vw = window.innerWidth;
          const width = Math.min(352, vw - 16);
          let left = rect.right - width;
          left = Math.max(8, Math.min(left, vw - width - 8));
          return createPortal(
            <>
              <div
                onMouseDown={() => setHelpPopover({ open: false, anchor: null })}
                style={{ position: 'fixed', inset: 0, zIndex: 9997, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              />
              <div
                style={{
                  position: 'fixed',
                  bottom: window.innerHeight - rect.top + 4,
                  left,
                  width,
                  zIndex: 9998,
                }}
                className="pointer-events-auto"
              >
                <div className={`${LIQUID_GLASS_TOAST_PANEL_CLASS} !flex-col max-h-[min(70vh,28rem)] overflow-hidden p-4 animate-toast-in`}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Icon name="info" className="text-base text-info" />
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{t('dashboard.viewHelp')}</p>
                  </div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden">
                    <div className="space-y-3 text-xs leading-normal text-slate-500 dark:text-gray-400 text-left">
                      <div>
                        <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.mainToggleHelp.title')}</p>
                        <div className="space-y-1.5">
                          {MAIN_TOGGLE_STATES.map(state => (
                            <div key={state} className="flex items-center gap-2.5">
                              <MainToggleIndicator state={state} />
                              <span className="flex-1 truncate">{t(`dashboard.mainToggleHelp.${state}`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-slate-200/70 dark:border-dark-border/60 pt-2">
                        <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.pinHelp.title')}</p>
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="relative w-9 h-5 rounded-md overflow-hidden border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-bg-card flex-shrink-0"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 30 30"
                              className="absolute top-0 left-0"
                            >
                              <polygon points="0,0 30,0 0,30" className="fill-[#fee2e2] dark:fill-[#7f1d1d]" />
                              <polygon points="0,0 20,0 0,20" className="fill-[#f87171] dark:fill-[#dc2626]" />
                              <polygon points="0,0 10,0 0,10" className="fill-[#b71422] dark:fill-[#fca5a5]" />
                            </svg>
                          </span>
                          <span className="flex-1">{t('dashboard.pinHelp.desc')}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200/70 dark:border-dark-border/60 pt-2">
                        <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.sidebarHelp.title')}</p>
                        <div className="flex items-start gap-2">
                          <Icon name="view_sidebar" className="text-base text-slate-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                          <span>{t('dashboard.sidebarHelp.desc')}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200/70 dark:border-dark-border/60 pt-2">
                        <p className="mb-1.5 font-bold text-slate-800 dark:text-gray-200">{t('dashboard.statsHelp.title')}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                            <span><span className="font-bold text-slate-700 dark:text-gray-200">{t('dashboard.stats.total')}</span>　{t('dashboard.statsHelp.total')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                            <span><span className="font-bold text-slate-700 dark:text-gray-200">{t('dashboard.stats.enabled')}</span>　{t('dashboard.statsHelp.enabled')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            <span><span className="font-bold text-slate-700 dark:text-gray-200">{t('dashboard.stats.disabled')}</span>　{t('dashboard.statsHelp.disabled')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>,
            document.body
          );
        })()}

      {/* Operation Log Popover */}
      {logPopoverAnchor && (
        <OperationLogPopover
          anchorRect={logPopoverAnchor}
          onClose={() => setLogPopoverAnchor(null)}
          openAbove
        />
      )}

      {/* Card Context Menu */}
      <CardContextMenu
        open={cardContextMenu.open}
        x={cardContextMenu.x}
        y={cardContextMenu.y}
        onClose={() => setCardContextMenu((prev) => ({ ...prev, open: false }))}
        pinned={!!cardContextMenu.skillId && pinnedIds.has(cardContextMenu.skillId)}
        onTogglePin={() => {
          if (cardContextMenu.skillId) handleTogglePin(cardContextMenu.skillId);
        }}
      />
    </>
  );
};
