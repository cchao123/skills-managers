import { useState, useCallback } from 'react';
import { skillsApi } from '../../../api/tauri';
import { useToast } from '../../../components/Toast';
import type { SkillMetadata, SkillFileEntry } from '../../../types';

export const useSkillModal = () => {
  const { showToast } = useToast();
  const [detailSkill, setDetailSkill] = useState<SkillMetadata | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [skillFiles, setSkillFiles] = useState<SkillFileEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFile, setCurrentFile] = useState<{ path: string; content: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const loadSkillFiles = useCallback(async (skillId: string) => {
    try {
      setLoadingFiles(true);
      const files = await skillsApi.getFiles(skillId);
      setSkillFiles(files);

      // Auto-expand first level folders
      const firstLevelFolders = new Set<string>();
      files.forEach(file => {
        if (file.is_dir) {
          firstLevelFolders.add(file.path);
        }
      });
      setExpandedFolders(firstLevelFolders);

      // Find SKILL.md recursively
      const findSkillMd = (entries: SkillFileEntry[]): SkillFileEntry | null => {
        for (const entry of entries) {
          if (entry.name === 'SKILL.md' && !entry.is_dir) {
            return entry;
          }
          if (entry.children) {
            const found = findSkillMd(entry.children);
            if (found) return found;
          }
        }
        return null;
      };

      // Load SKILL.md by default
      const skillMd = findSkillMd(files);
      if (skillMd) {
        try {
          console.log('Loading SKILL.md from:', skillMd.path);
          const content = await skillsApi.readFile(skillId, skillMd.path);
          setCurrentFile({ path: skillMd.path, content });
        } catch (error) {
          console.error('Failed to load SKILL.md:', error);
        }
      } else {
        console.log('SKILL.md not found in files:', files);
      }

      setLoadingFiles(false);
    } catch (error) {
      console.error('Failed to load skill files:', error);
      setLoadingFiles(false);
    }
  }, []);

  const handleShowSkillDetail = useCallback(async (skill: SkillMetadata) => {
    try {
      setDetailSkill(skill);
      setShowDetailModal(true);
      setCurrentFile(null);
      loadSkillFiles(skill.id);
    } catch (error) {
      console.error('Failed to load skill detail:', error);
      showToast('error', '加载技能详情失败');
    }
  }, [loadSkillFiles, showToast]);

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setDetailSkill(null);
    setSkillFiles([]);
    setCurrentFile(null);
    setExpandedFolders(new Set());
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  const handleReadFile = useCallback(async (filePath: string, showLoading = true) => {
    if (!detailSkill) return;

    try {
      if (showLoading) {
        setLoadingFile(true);
      }
      const content = await skillsApi.readFile(detailSkill.id, filePath);
      setCurrentFile({ path: filePath, content });
      if (showLoading) {
        setLoadingFile(false);
      }
    } catch (error) {
      console.error('Failed to read file:', error);
      if (showLoading) {
        setLoadingFile(false);
      }
      showToast('error', '读取文件失败');
    }
  }, [detailSkill, showToast]);

  return {
    detailSkill,
    showDetailModal,
    skillFiles,
    loadingFiles,
    expandedFolders,
    currentFile,
    loadingFile,
    handleShowSkillDetail,
    handleCloseDetailModal,
    toggleFolder,
    handleReadFile,
  };
};
