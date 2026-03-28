export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  icon: string;
  iconColor: string;
  rating: number;
  downloads: string;
  author: string;
  installed?: boolean;
}

export interface SkillCategory {
  name: string;
  count: number;
}
