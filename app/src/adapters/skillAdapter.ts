import type { SkillMetadata, SkillSource } from '@/types';

// Backend returns data in this format (matches Rust serialization)
export interface BackendSkillMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  agent_enabled: Record<string, boolean>;
  agent_enabled_backup?: Record<string, boolean>;
  source: SkillSource | undefined;  // Rust serializes as optional even though it's required
  author?: string;
  version?: string;
  repository?: string;
  installed_at: string;
  last_updated: string;
  path?: string;
  is_collected?: boolean;
}

/**
 * Adapt a single skill metadata from backend format to frontend format
 * Handles any field mapping or transformations needed
 */
export const adaptSkillMetadata = (
  backendData: BackendSkillMetadata
): SkillMetadata => {
  return {
    id: backendData.id,
    name: backendData.name,
    description: backendData.description,
    category: backendData.category,
    enabled: backendData.enabled,
    agent_enabled: backendData.agent_enabled || {},
    agent_enabled_backup: backendData.agent_enabled_backup,
    source: backendData.source,
    author: backendData.author,
    version: backendData.version,
    repository: backendData.repository,
    installed_at: backendData.installed_at,
    last_updated: backendData.last_updated,
    path: backendData.path,
    is_collected: backendData.is_collected,
  };
};

/**
 * Adapt a list of skill metadata from backend format to frontend format
 */
export const adaptSkillMetadataList = (
  backendList: BackendSkillMetadata[]
): SkillMetadata[] => {
  return backendList.map(adaptSkillMetadata);
};
