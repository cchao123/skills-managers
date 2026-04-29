import type { SkillFileEntry } from '@/types';

import { Icon } from '@/components/Icon';
interface CardFileTreeProps {
  files: SkillFileEntry[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onReadFile?: (path: string) => void;
  currentFile?: string;
  level?: number;
  showFileSize?: boolean;
}

export default function CardFileTree({
  files,
  expandedFolders,
  onToggleFolder,
  onReadFile,
  currentFile,
  level = 0,
  showFileSize = true,
}: CardFileTreeProps) {
  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return 'folder';
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md': return 'description';
      case 'ts': case 'js': return 'code';
      case 'json': return 'data_object';
      case 'html': return 'language';
      case 'css': return 'style';
      case 'sh': return 'terminal';
      case 'txt': return 'text_snippet';
      default: return 'insert_drive_file';
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-0.5">
      {files.map((file) => {
        const path = file.path;
        const isDir = file.is_dir;
        const isExpanded = expandedFolders.has(path);
        const hasReadFile = onReadFile && !isDir;
        const isActive = currentFile === path && hasReadFile;

        return (
          <div key={path}>
            <div
              className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                isActive
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-slate-600 dark:text-gray-300'
              }`}
              style={{ paddingLeft: `${level * 14 + 6}px` }}
              onClick={() => {
                if (isDir) {
                  onToggleFolder(path);
                } else if (onReadFile) {
                  onReadFile(path);
                }
              }}
            >
              <Icon name={isDir && isExpanded ? 'folder_open' : getFileIcon(file.name, isDir)} className="text-sm text-slate-400 dark:text-gray-500" />
              <span className="text-[11px] flex-1 truncate">{file.name}</span>
              {showFileSize && file.size && (
                <span className="text-[10px] text-slate-400 dark:text-gray-500">{formatSize(file.size)}</span>
              )}
            </div>
            {isDir && isExpanded && file.children && (
              <CardFileTree
                files={file.children}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onReadFile={onReadFile}
                currentFile={currentFile}
                level={level + 1}
                showFileSize={showFileSize}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
