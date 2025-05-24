export type EventCategory = 
  | 'code_commit'
  | 'code_pr'
  | 'code_create'
  | 'comment'
  | 'post'
  | 'reaction'
  | 'issue';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
  socialLinks?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    reddit?: string;
  };
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  content: string;
  category: EventCategory;
  platform: string;
  user: User;
  sentiment?: {
    score: number;
    label: string;
  };
  entities?: Array<{
    text: string;
    type: string;
    confidence: number;
  }>;
  topics?: string[];
  metadata: Record<string, unknown>;
}

export interface VisualizationConfig {
  /** Timeline theme */
  theme: 'default' | 'dark' | 'light' | 'minimal' | 'colorful';
  
  /** Color palette */
  colors?: string[];
  
  /** Custom CSS URL */
  customCss?: string;
  
  /** Interactive features */
  interactive: {
    /** Enable filtering UI */
    filtering: boolean;
    
    /** Enable search box */
    search: boolean;
    
    /** Enable clustering of similar events */
    clustering: boolean;
    
    /** Enable map view for geo events */
    map: boolean;
  };
} 