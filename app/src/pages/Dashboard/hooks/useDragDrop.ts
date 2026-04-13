import { useEffect, useState, useCallback, useRef } from 'react';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export const useDragDrop = (onImportComplete?: () => void) => {
  const { showToast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);

  const handleDrop = useCallback(async (paths: string[]) => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);

    const allPaths = paths;
    let successCount = 0;
    let errorMsg = '';

    for (const folder of allPaths) {
      try {
        const name = await skillsApi.importFolder(folder);
        successCount++;
        console.log(`Imported skill: ${name}`);
      } catch (error) {
        const msg = typeof error === 'string' ? error : (error as Error)?.message || '导入失败';
        errorMsg = msg;
        console.error(`Failed to import ${folder}:`, error);
      }
    }

    if (successCount > 0) {
      showToast('success', `成功导入 ${successCount} 个技能`);
      onImportComplete?.();
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
