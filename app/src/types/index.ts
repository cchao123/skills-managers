export type { Skill } from './skills';

// Skill Metadata (matches backend Schema v2)
//
// 后端按 id 合并物理副本：同一个 skill 只会返回一条记录。
// - `agent_enabled` 由 `sources`（原生自动开启）+ `open`（主动链接）派生
// - `sources` / `primary` / `open` / `source_paths` 描述多源布局
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  agent_enabled: Record<string, boolean>;
  is_collected?: boolean;
  author?: string;
  version?: string;
  /** 技能目录体积（字节），后端可选返回 */
  size?: number;
  installed_at: string;
  last_updated: string;

  /** 物理副本所在位置（'global' 或 agent 名） */
  sources: string[];
  /** 链接到非原生 Agent 时默认用哪份副本为源 */
  primary: string;
  /** 用户主动启用的非原生 Agent */
  open: string[];
  /** 每个 source 对应的物理路径 */
  source_paths: Record<string, string>;
  /** 从 marketplace 下载时写入的来源仓库 URL */
  source_repository?: string;
}

/**
 * 多源删除场景用的行数据：一条 skill 在某个具体源下的视图。
 * DeleteConfirmModal 以此为单位展示/勾选/删除。
 */
export interface SkillDeletionRow {
  skill: SkillMetadata;
  /** 本行针对的具体 source（'global' 或 agent 名） */
  source: string;
  /** 本源对应的物理路径（从 `skill.source_paths` 取得，可能缺失） */
  path?: string;
}

// Skill file entry for directory tree
export interface SkillFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  children?: SkillFileEntry[];
}

// Agent Configuration (matches backend Phase 1)
export interface AgentConfig {
  name: string;                  // Unique identifier (e.g., "claude", "cursor")
  display_name: string;          // Human-readable name (e.g., "Claude", "Cursor")
  path: string;                  // Base path (e.g., "~/.claude")
  skills_path: string;           // Relative skills path (e.g., "skills" under agent home)
  enabled: boolean;              // Whether agent is active
  detected: boolean;             // Whether agent is installed on system
}

// Linking strategy: how to "link" skills from Skills Manager root into agent directories.
// Backend uses PascalCase (matches Rust enum variants), keep that form for IPC compatibility.
export const LINK_TYPE = {
  Symlink: 'Symlink',
  Copy: 'Copy',
} as const;

export type LinkType = typeof LINK_TYPE[keyof typeof LINK_TYPE];

// Application Configuration (matches backend Phase 1)
export interface AppConfig {
  linking_strategy: LinkType;             // File linking strategy
  agents: AgentConfig[];                  // List of configured agents
  skill_hide_prefixes?: string[];         // Prefix rules used to hide skills in UI and tray
  pinned_skills?: string[];               // Skill ids pinned to the top of the dashboard
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  last_sync?: string;
}

export interface GitHubConfig {
  repositories: Record<string, GitHubRepoConfig>;
}

// 某个 source 及其物理路径；useMergedView 从 SkillMetadata.source_paths 派生。
export interface SourcePathInfo {
  source: string;
  path: string;
}
