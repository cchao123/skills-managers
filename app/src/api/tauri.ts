import { invoke } from '@tauri-apps/api/core';
import type { SkillMetadata, GitHubConfig, AgentConfig, AppConfig, SkillFileEntry, GitHubSkill } from '@/types';
import { adaptSkillMetadataList, BackendSkillMetadata } from '@/adapters/skillAdapter';

export const skillsApi = {
  list: async (): Promise<SkillMetadata[]> => {
    const data = await invoke<BackendSkillMetadata[]>('list_skills');
    return adaptSkillMetadataList(data);
  },

  enable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('enable_skill', { skillId, agent });
  },

  disable: async (skillId: string, agent?: string): Promise<void> => {
    await invoke('disable_skill', { skillId, agent });
  },

  getContent: async (skillId: string): Promise<string> => {
    return await invoke('get_skill_content', { skillId });
  },

  getFiles: async (skillId: string): Promise<SkillFileEntry[]> => {
    return await invoke('get_skill_files', { skillId });
  },

  readFile: async (skillId: string, filePath: string): Promise<string> => {
    return await invoke('read_skill_file', { skillId, filePath });
  },

  rescan: async (): Promise<SkillMetadata[]> => {
    const data = await invoke<BackendSkillMetadata[]>('rescan_skills');
    return adaptSkillMetadataList(data);
  },

  delete: async (skillId: string): Promise<void> => {
    await invoke('delete_skill', { skillId });
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
  setLinkingStrategy: async (strategy: 'Symlink' | 'Copy'): Promise<void> => {
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
};

export const githubApi = {
  addRepo: async (params: {
    name: string;
    owner: string;
    repo: string;
    branch: string;
    token?: string;
    path: string;
  }): Promise<void> => {
    await invoke('add_github_repo', { name: params.name, owner: params.owner, repo: params.repo, branch: params.branch, token: params.token, path: params.path });
  },

  removeRepo: async (name: string): Promise<void> => {
    await invoke('remove_github_repo', { name });
  },

  listRepos: async (): Promise<string[]> => {
    return await invoke('list_github_repos');
  },

  syncRepo: async (name: string, _branch: string): Promise<void> => {
    await invoke('sync_github_repo', { request: { name } });
  },

  restoreFromGithub: async (name: string): Promise<number> => {
    return await invoke<number>('restore_from_github', { request: { name } });
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
    path: string;
    token?: string;
  }): Promise<void> => {
    await invoke('save_github_config', { owner: config.owner, repo: config.repo, branch: config.branch, path: config.path, token: config.token });
  },

  openSkillsManagerFolder: async (): Promise<void> => {
    await invoke('open_skills_manager_folder');
  },

  starRepo: async (owner: string, repo: string, token: string): Promise<boolean> => {
    return await invoke<boolean>('star_github_repo', { owner, repo, token });
  },

  checkStar: async (owner: string, repo: string, token: string): Promise<boolean> => {
    return await invoke<boolean>('check_github_star', { owner, repo, token });
  },

  /**
   * 扫描 GitHub 仓库列表
   */
  scanRepos: async (repos: string[], token?: string): Promise<GitHubSkill[]> => {
    return await invoke<GitHubSkill[]>('scan_github_repos', { repos, token });
  },

  /**
   * 从 GitHub 安装技能
   */
  install: async (repoUrl: string, agents: string[]): Promise<void> => {
    await invoke('install_from_github', { repoUrl, agents });
  },

  /**
   * 获取默认仓库列表
   */
  getDefaultRepos: async (): Promise<string[]> => {
    return await invoke<string[]>('get_default_repos');
  },
};
