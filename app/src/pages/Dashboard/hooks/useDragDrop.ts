import { useEffect, useCallback, useRef } from 'react';
import { useBoolean } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { skillsApi } from '@/api/tauri';
import { useToast } from '@/components/Toast';
import { appendOperationLog } from '@/pages/Dashboard/hooks/useOperationLog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { SOURCE } from '@/pages/Dashboard/utils/source';

export const useDragDrop = (
  onImportComplete?: (importedNames: string[], targetSource: string) => void,
  selectedSource?: string,
) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isDragOver, { setTrue: setDragOverTrue, setFalse: setDragOverFalse }] = useBoolean(false);
  const [importing, { setTrue: setImportingTrue, setFalse: setImportingFalse }] = useBoolean(false);
  const importingRef = useRef(false);

  const handleDrop = useCallback(async (paths: string[]) => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImportingTrue();

    // ALL / Global → 根目录；选中了 agent → 先存根目录再复制进 agent
    const targetAgent = selectedSource && selectedSource !== SOURCE.All && selectedSource !== SOURCE.Global
      ? selectedSource
      : null;

    const importedNames: string[] = [];
    // 与后端 `import_skill_folder` 的错误文案保持一致：`根目录中已存在技能 'xxx'...`
    const EXISTS_REGEX = /已存在技能\s*'([^']+)'/;
    const resolvedNames: string[] = []; // 包括成功导入的 + 冲突已存在的，用于前端定位
    let errorMsg = '';

    for (const folder of paths) {
      try {
        const name = await skillsApi.importFolder(folder);
        importedNames.push(name);
        resolvedNames.push(name);
        appendOperationLog({ type: 'dragImport', skillName: name, folderPath: folder });
        if (targetAgent) {
          await skillsApi.copyToAgent(name, SOURCE.Global, targetAgent, true);
        }
      } catch (error) {
        const msg = typeof error === 'string' ? error : (error as Error)?.message || '导入失败';
        const existsMatch = msg.match(EXISTS_REGEX);
        // 根目录已存在 + 目标是 agent：直接从根目录复制到 agent，不算失败
        if (existsMatch && targetAgent) {
          const name = existsMatch[1];
          try {
            await skillsApi.copyToAgent(name, SOURCE.Global, targetAgent, true);
            importedNames.push(name);
            resolvedNames.push(name);
          } catch (copyErr) {
            errorMsg = typeof copyErr === 'string' ? copyErr : (copyErr as Error)?.message || '导入失败';
            resolvedNames.push(name);
          }
        } else {
          errorMsg = msg;
          if (existsMatch) resolvedNames.push(existsMatch[1]);
          console.error(`Failed to import ${folder}:`, error);
        }
      }
    }

    const finalTarget = targetAgent ?? SOURCE.Global;
    if (importedNames.length > 0) {
      showToast('success', t('dashboard.toast.importSkillsSuccess', { count: importedNames.length }));
    }
    if (errorMsg) {
      showToast('error', errorMsg);
    }
    if (resolvedNames.length > 0) {
      onImportComplete?.(resolvedNames, finalTarget);
    }
    importingRef.current = false;
    setImportingFalse();
  }, [showToast, onImportComplete, selectedSource]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    getCurrentWebview().onDragDropEvent((event) => {
      if (!mounted) return;

      const payload = event.payload as any;
      const { type } = payload;

      // 检查拖拽位置是否在任何 drag region 内（如 SideNavBar、标题栏等）
      // 如果是，则不处理拖拽事件，让 OS 窗口拖拽接管
      if (payload.position) {
        const dragRegions = document.querySelectorAll('[data-tauri-drag-region]');
        let isInDragRegion = false;
        for (const region of dragRegions) {
          const rect = region.getBoundingClientRect();
          if (
            payload.position.x >= rect.left &&
            payload.position.x <= rect.right &&
            payload.position.y >= rect.top &&
            payload.position.y <= rect.bottom
          ) {
            isInDragRegion = true;
            break;
          }
        }
        if (isInDragRegion) {
          return;
        }
      }

      if (type === 'enter') {
        setDragOverTrue();
      } else if (type === 'leave') {
        setDragOverFalse();
      } else if (type === 'drop') {
        setDragOverFalse();
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
