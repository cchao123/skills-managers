/**
 * Skill 卡片置顶指示器：三个由浅到深的等距直角三角形叠加在左上角，
 * 形成"折角 / 多层标签"视觉。卡片本身的 `overflow-hidden + rounded-xl`
 * 会自动把三角形按圆角裁剪。
 *
 * 颜色方案：
 * - 浅色模式：外→内 由淡到浓的红，深色 tip 在白底上呈"印章"感。
 * - 深色模式：外层用偏暗的红与深色卡片背景过渡，内层用更亮的粉红做"高光 tip"，
 *   防止原配色（外白内深红）在黑底下出现"白色刺眼 + 内三角融化"的问题。
 */
interface PinIndicatorProps {
  pinned: boolean;
}

export function PinIndicator({ pinned }: PinIndicatorProps) {
  if (!pinned) return null;
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      className="absolute top-0 left-0 z-30 pointer-events-none"
      aria-hidden="true"
    >
      <polygon
        points="0,0 30,0 0,30"
        className="fill-[#fee2e2] dark:fill-[#7f1d1d]"
      />
      <polygon
        points="0,0 20,0 0,20"
        className="fill-[#f87171] dark:fill-[#dc2626]"
      />
      <polygon
        points="0,0 10,0 0,10"
        className="fill-[#b71422] dark:fill-[#fca5a5]"
      />
    </svg>
  );
}

export default PinIndicator;
