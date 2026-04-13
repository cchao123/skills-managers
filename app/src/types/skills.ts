export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  icon: string;
  iconColor: string;
  enabledAgentCount: number;
  totalAgentCount: number;
  size?: number;
  author: string;
  installed?: boolean;
}

export interface SkillCategory {
  name: string;
  count: number;
}
