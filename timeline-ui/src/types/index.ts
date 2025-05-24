export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  content: string;
  category: 'code_commit' | 'code_pr' | 'code_create' | 'comment' | 'post' | 'reaction';
  platform: string;
  username: string;
  url?: string;
  sentiment?: SentimentScore;
  entities?: Entity[];
  topics?: string[];
  location?: {
    lat: number;
    lng: number;
    name: string;
  };
  media?: Array<{
    type: 'image' | 'document';
    url: string;
    description?: string;
    metadata?: {
      patch?: string;
      [key: string]: any;
    };
  }>;
  relations?: Array<{
    type: string;
    targetId: string;
  }>;
  metadata: Record<string, any>;
}

export interface SentimentScore {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface Entity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'other' | 'mention';
  confidence: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'event' | 'entity' | 'user';
  name: string;
  value: number;
  platform?: string;
  size?: number;
  color?: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number;
  type: string;
  label?: string;
} 