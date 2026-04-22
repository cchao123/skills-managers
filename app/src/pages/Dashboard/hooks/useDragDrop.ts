import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { appendOperationLog } from '@/pages/Dashboard/hooks/useOperationLog';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export const useDragDrop = (onImportComplete?: (importedNames: string[]) => void) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);

  const handleDrop = useCallback(async (paths: string[]) => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);

    const importedNames: string[] = [];
    let errorMsg = '';

    for (const folder of paths) {
      try {
        const name = await skillsApi.importFolder(folder);
        importedNames.push(name);
        appendOperationLog({ type: 'dragImport', skillName: name, folderPath: folder });
      } catch (error) {
        const msg = typeof error === 'string' ? error : (error as Error)?.message || '导入失败';
        errorMsg = msg;
        console.error(`Failed to import ${folder}:`, error);
      }
    }

    if (importedNames.length > 0) {
      showToast('success', t('dashboard.toast.importSkillsSuccess', { count: importedNames.length }));
      onImportComplete?.(importedNames);
    }
    if (errorMsg) {
      showToast('error', errorMsg);
    }
    importingRef.current = false;
    setImporting(false);
  }, [showToast, onImportComplete]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    const dragRegion = document.querySelector('[data-tauri-drag-region]');

    getCurrentWebview().onDragDropEvent((event) => {
      if (!mounted) return;

      const payload = event.payload as any;
      const { type } = payload;

      if (payload.position && dragRegion) {
        const rect = dragRegion.getBoundingClientRect();
        if (payload.position.y <= rect.bottom) {
          return;
        }
      }

      if (type === 'enter') {
        setIsDragOver(true);
      } else if (type === 'leave') {
        setIsDragOver(false);
      } else if (type === 'drop') {
        setIsDragOver(false);
        handleDrop(payload.paths);
      }
    }).then(fn => {
      unlisten = fn;
    }).catch(e => {
      console.error('Drag-drop setup failed:', e);
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [handleDrop]);

  return {
    isDragOver,
    importing,
  };
};
