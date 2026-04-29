import { invoke } from '@tauri-apps/api/core';
import type { SkillMetadata, GitHubConfig, AgentConfig, AppConfig, SkillFileEntry, LinkType } from '@/types';

export const skillsApi = {
  list: async (): Promise<SkillMetadata[]> => {
    return await invoke<SkillMetadata[]>('list_skills');
  },

  enable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('enable_skill', { skillId, agent });
  },

  disable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('disable_skill', { skillId, agent });
  },

  setPrimary: async (skillId: string, newPrimary: string): Promise<void> => {
    await invoke('set_skill_primary', { skillId, newPrimary });
  },

  getContent: async (skillId: string): Promise<string> => {
    return await invoke('get_skill_content', { skillId });
  },

  getFiles: async (skillId: string, source?: string): Promise<SkillFileEntry[]> => {
    return await invoke('get_skill_files', { skillId, source });
  },

  readFile: async (skillId: string, filePath: string, source?: string): Promise<string> => {
    return await invoke('read_skill_file', { skillId, filePath, source });
  },

  rescan: async (): Promise<SkillMetadata[]> => {
    return await invoke<SkillMetadata[]>('rescan_skills');
  },

  delete: async (skillId: string, source?: string): Promise<void> => {
    await invoke('delete_skill', { skillId, source });
  },

  importFolder: async (folderPath: string): Promise<string> => {
    return await invoke<string>('import_skill_folder', { folderPath });
  },
};

export const agentsApi = {
  /**
   * Get list of all configured agents
   */
  list: async (): Promise<AgentConfig[]> => {
    return await invoke<AgentConfig[]>('get_agents');
  },

  /**
   * Add a new agent configuration
   */
  add: async (agent: AgentConfig): Promise<void> => {
    await invoke('add_agent', { agent });
  },

  /**
   * Remove an agent by name
   */
  remove: async (name: string): Promise<void> => {
    await invoke('remove_agent', { name });
  },

  /**
   * Get full application configuration
   */
  getConfig: async (): Promise<AppConfig> => {
    return await invoke<AppConfig>('get_config');
  },

  /**
   * Set the file linking strategy
   */
  setLinkingStrategy: async (strategy: LinkType): Promise<void> => {
    await invoke('set_linking_strategy', { strategy });
  },

  /**
   * Open the skills manager folder in system file manager
   */
  openFolder: async (): Promise<void> => {
    await invoke('open_skills_manager_folder');
  },

  /**
   * Open a specific folder path in system file manager
   */
  openFolderPath: async (path: string): Promise<void> => {
    await invoke('open_folder', { path });
  },

  /**
   * Detect which agents are installed on the system
   * Returns updated agent list with detection status
   */
  detect: async (): Promise<AgentConfig[]> => {
    return await invoke<AgentConfig[]>('detect_agents');
  },

  /**
   * Persist skill hide prefixes to backend config and refresh the tray menu.
   * Frontend still reads localStorage as the source of truth for UI; this only
   * keeps the native tray in sync.
   */
  setSkillHidePrefixes: async (prefixes: string[]): Promise<void> => {
    await invoke('set_skill_hide_prefixes', { prefixes });
  },
};

/** Skill 置顶（pin）相关命令 */
export const pinApi = {
  /** 设置某个 skill 是否置顶；持久化到 AppConfig.pinned_skills */
  setPinned: async (skillId: string, pinned: boolean): Promise<void> => {
    await invoke('set_skill_pinned', { skillId, pinned });
  },
  /** 读取持久化的置顶 skill_id 列表（按用户置顶顺序返回） */
  list: async (): Promise<string[]> => {
    return await invoke<string[]>('get_pinned_skills');
  },
};

export const githubApi = {
  syncRepo: async (
    name: string,
    _branch: string,
    options?: { overwriteRemote?: boolean }
  ): Promise<void> => {
    await invoke('sync_github_repo', {
      request: {
        name,
        overwriteRemote: options?.overwriteRemote ?? false,
      },
    });
  },

  restoreFromGithub: async (name: string, overwriteLocal = false): Promise<number> => {
    return await invoke<number>('restore_from_github', { request: { name, overwriteLocal } });
  },

  getConfig: async (): Promise<GitHubConfig> => {
    return await invoke('get_github_config');
  },

  testConnection: async (config: {
    owner: string;
    repo: string;
    branch: string;
    token: string;
  }): Promise<void> => {
    await invoke('test_github_connection', { owner: config.owner, repo: config.repo, branch: config.branch, token: config.token });
  },

  saveConfig: async (config: {
    owner: string;
    repo: string;
    branch: string;
    token?: string;
  }): Promise<void> => {
    await invoke('save_github_config', { owner: config.owner, repo: config.repo, branch: config.branch, token: config.token });
  },

  openSkillsManagerFolder: async (): Promise<void> => {
    await invoke('open_skills_manager_folder');
  },

};
