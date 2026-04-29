import { OCTOPUS_LOGO_URL } from '@/lib/assets';
import { getAgentIcon, needsInvertInDark } from '@/pages/Dashboard/utils/agentHelpers';

interface NativeSourceWatermarkProps {
  /** 原生 agent 名称列表（数组或 Set），按出现顺序选第一个作为水印 */
  nativeAgents: Iterable<string>;
  /** 是否在根目录中：为 true 时优先使用章鱼 logo 作为水印 */
  inRoot?: boolean;
  /** 单个图标尺寸（px），默认 110 */
  size?: number;
  /** 不透明度，默认 0.07 */
  opacity?: number;
  className?: string;
}

/**
 * 来源水印：根据 skill 的来源在卡片右下角投一个淡淡的图标，体现"这条 skill 来自哪里"。
 *
 * 优先级（每次只显示一个）：
 * 1. `nativeAgents` 的第一个原生 agent → 该 agent 的 SVG 图标
 *    （因为 Root 通常是把原生目录复制 / 链接过来，原生来源更能代表 skill 的"出身"）
 * 2. 否则当 `inRoot === true` → 章鱼 logo（`OCTOPUS_LOGO_URL`），表示仅存在于根目录
 *
 * 使用要求：父容器需要 `position: relative` 且建议 `overflow-hidden`。
 * 自身 `pointer-events-none` 不阻挡交互。
 */
export function NativeSourceWatermark({
  nativeAgents,
  inRoot = false,
  size = 110,
  opacity = 0.07,
  className = '',
}: NativeSourceWatermarkProps) {
  let iconSrc: string | null = null;
  let dark = false;

  const firstNative = Array.from(nativeAgents)[0];
  if (firstNative) {
    iconSrc = getAgentIcon(firstNative);
    dark = needsInvertInDark(firstNative);
  } else if (inRoot) {
    iconSrc = OCTOPUS_LOGO_URL;
  }

  if (!iconSrc) return null;

  return (
    <div
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      <img
        src={iconSrc}
        alt=""
        draggable={false}
        className={dark ? 'dark:invert' : ''}
        style={{
          position: 'absolute',
          right: -size * 0.18,
          bottom: -size * 0.18,
          width: size,
          height: size,
          opacity,
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

export default NativeSourceWatermark;
