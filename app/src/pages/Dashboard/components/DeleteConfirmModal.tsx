import type { SkillMetadata } from '@/types';
import { agentsApi } from '@/api/tauri';

interface DeleteConfirmModalProps {
  target: SkillMetadata | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  target,
  onConfirm,
  onCancel,
}) => {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-white/95 dark:bg-dark-bg-card backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),0_18px_36px_-18px_rgba(0,0,0,0.3)] border border-white/50 dark:border-dark-border overflow-hidden flex flex-col items-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-red-500 text-4xl"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            error
          </span>
        </div>
        <h3 className="font-bold text-2xl text-slate-900 dark:text-white mb-2">删除确认</h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed mb-8 px-4">
          确定要删除技能 <strong className="text-slate-900 dark:text-white">{target.name}</strong> 吗？
          <br />此操作将从 <span className="text-blue-500 underline cursor-pointer" onClick={() => agentsApi.openFolderPath(target.path || '')}>Skills Manager</span> 根目录删除技能文件并移除所有符号链接，且不可撤销。
        </p>
        <div className="w-full flex gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            确认删除
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 bg-slate-100 dark:bg-dark-bg-tertiary text-slate-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-dark-bg-secondary transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
