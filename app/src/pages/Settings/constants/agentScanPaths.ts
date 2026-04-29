/**
 * 各 agent 的技能扫描目录映射。
 *
 * 与 `src-tauri/src/scanner.rs::scan_all_skill_sources` 中的硬编码保持一致：
 * - 若该文件的扫描路径调整，请同步更新此处常量。
 * - 未列出的 agent（opencode）当前无专门的扫描路径。
 */
const AGENT_SCAN_PATHS: Record<string, string[]> = {
  claude: [
    '~/.claude/skills',
    '~/.claude/plugins/cache',
  ],
  cursor: [
    '~/.cursor/skills',
    '~/.cursor/skills-cursor',
    '~/.cursor/plugins/cache/cursor-public',
  ],
  openclaw: [
    '~/.openclaw/skills',
  ],
  codex: [
    '~/.codex/skills',
  ],
  opencode: [
    '~/.opencode/skills',
  ],
  trae: [
    '~/.trae/skills',
  ],
  qoder: [
    '~/.qoder/skills',
  ],
  antigravity: [
    '~/.antigravity/skills',
  ],
  kiro: [
    '~/.kiro/skills',
  ],
};

export const getAgentScanPaths = (name: string): string[] =>
  AGENT_SCAN_PATHS[name] ?? [];
