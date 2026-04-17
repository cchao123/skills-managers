export type { Skill, SkillCategory } from './skills';

// Skill source type
export type SkillSource = 'global' | 'cursor' | 'claude' | 'openclaw' | 'codex';

// Skill Metadata (matches backend Phase 1)
export interface SkillMetadata {
  id: string;                    // Unique identifier (e.g., "superpowers:subagent-driven-development")
  name: string;                  // Skill name
  description: string;           // Skill description
  category: string;              // Skill category
  enabled: boolean;              // Globally enabled flag
  agent_enabled: Record<string, boolean>;  // Per-agent enablement (changed from agent_disabled)
  agent_enabled_backup?: Record<string, boolean>;  // Backup of agent states before main toggle
  source?: SkillSource;          // Where the skill comes from
  is_collected?: boolean;         // Whether skill is physically copied to any agent's skills dir
  author?: string;               // Author (optional)
  version?: string;              // Version (optional)
  repository?: string;           // Repository URL (optional)
  /** 技能目录体积（字节），后端可选返回 */
  size?: number;
  installed_at: string;          // Installation timestamp
  last_updated: string;          // Last update timestamp
  path?: string;                 // Full file system path (optional, used for creating symlinks)
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
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  path: string;
  enabled: boolean;
  last_sync?: string;
}

export interface GitHubConfig {
  repositories: Record<string, GitHubRepoConfig>;
}

// GitHub 技能信息（用于 Marketplace）
export interface GitHubSkill {
  id: string;                    // "owner/repo"
  name: string;                  // 技能名称
  description: string;           // 描述
  category: string;              // 分类
  author: string;                // 作者
  version?: string;              // 版本
  stars: number;                 // Stars 数量
  repository: string;            // 仓库 URL
  default_branch: string;        // 默认分支
  updated_at: string;            // 更新时间
  install_status: 'installed' | 'downloaded' | 'available';
  enabled_agents: string[];      // 已启用的 Agent
}

// 安装状态
export type InstallStatus = 'installed' | 'downloaded' | 'available';

// 合并后的多来源 Skill 信息（平铺视图使用）
export interface SourcePathInfo {
  source: string;
  path: string;
}

export interface MergedSkillInfo {
  primary: SkillMetadata;
  sourceSkills: SkillMetadata[];
  allSources: string[];
  nativeAgents: Set<string>;
  allPaths: SourcePathInfo[];
}
