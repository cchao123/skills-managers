export const DragDropOverlay: React.FC = () => {
  return (
    <div className="fixed top-16 bottom-0 left-0 right-0 z-[99999] pointer-events-none">
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 border-4 border-[#b71422] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[#b71422] text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            drive_folder_upload
          </span>
          <p className="text-2xl font-black text-white tracking-wide">释放安装</p>
          <p className="text-sm text-white/70">文件夹需包含 SKILL.md</p>
        </div>
      </div>
    </div>
  );
};
