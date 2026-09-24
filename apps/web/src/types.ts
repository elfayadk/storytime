export type Platform =
  | 'github'
  | 'reddit'
  | 'rss'
  | 'mastodon'
  | 'bluesky'
  | 'pastebin'
  | 'hackernews'
  | 'devto'
  | 'gitlab'
  | 'wikipedia'
  | 'stackexchange';

export interface Sentiment {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
}
export interface Entity {
  value: string;
  type: string;
  confidence: number;
}
export interface GeoLocation {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}
export interface SerializedEvent {
  id: string;
  platform: Platform;
  category: string;
  timestamp: string;
  title: string;
  content: string;
  url: string;
  username: string;
  sentiment?: Sentiment;
  entities?: Entity[];
  topics?: string[];
  summary?: string;
  location?: GeoLocation;
  metrics?: Record<string, number | undefined>;
  metadata: Record<string, unknown>;
}
export interface Stats {
  totalEvents: number;
  byPlatform: Record<string, number>;
  byCategory: Record<string, number>;
  byDay: Record<string, number>;
  sentiment: { positive: number; negative: number; neutral: number };
  topEntities: { value: string; type: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  dateRange: { start: string | null; end: string | null };
}
export interface ActivityRhythm {
  byHour: number[];
  byWeekday: number[];
  grid: number[][];
  peakHour: number;
  peakWeekday: number;
  activeWindow: { startHour: number; endHour: number };
  summary: string;
  total: number;
}
export interface Insight {
  type: 'burst' | 'sentiment_shift' | 'quiet';
  date: string;
  score: number;
  detail: string;
}
export interface ClusterSummary {
  id: number;
  label: string;
  size: number;
  keywords: string[];
  eventIds: string[];
  summary?: string;
}
export interface Profile {
  platform: Platform;
  handle: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  url: string;
  location?: string;
  company?: string;
  blog?: string;
  followers?: number;
  following?: number;
  repos?: number;
  joined?: string;
  topLanguages?: { name: string; count: number }[];
  topRepos?: { name: string; url: string; stars: number; description?: string; language?: string }[];
}
export interface TimelineResult {
  id?: string;
  target: string;
  generatedAt: string;
  profile?: Profile;
  brief?: string;
  events: SerializedEvent[];
  stats: Stats;
  rhythm?: ActivityRhythm;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  narrative?: string;
  insights?: Insight[];
  clusters?: ClusterSummary[];
  embeddingProvider?: string;
}
export interface GraphNode {
  id: string;
  label: string;
  platform?: Platform;
  weight: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}
export interface SearchHit {
  score: number;
  event: SerializedEvent;
}
export interface AskResponse {
  question: string;
  answer: string | null;
  grounded: boolean;
  note?: string;
  sources: SearchHit[];
}
export interface Progress {
  phase: string;
  platform?: Platform;
  message: string;
  count?: number;
}

export const PLATFORM_META: Record<Platform, { icon: string; label: string }> = {
  github: { icon: '◓', label: 'GitHub' },
  reddit: { icon: '◉', label: 'Reddit' },
  rss: { icon: '▩', label: 'RSS' },
  mastodon: { icon: '◈', label: 'Mastodon' },
  bluesky: { icon: '◒', label: 'Bluesky' },
  pastebin: { icon: '▤', label: 'Pastebin' },
  hackernews: { icon: '▲', label: 'Hacker News' },
  devto: { icon: '◆', label: 'DEV' },
  gitlab: { icon: '▰', label: 'GitLab' },
  wikipedia: { icon: '◎', label: 'Wikipedia' },
  stackexchange: { icon: '△', label: 'Stack Overflow' },
};

export const ALL_PLATFORMS: Platform[] = [
  'github',
  'gitlab',
  'mastodon',
  'bluesky',
  'hackernews',
  'devto',
  'stackexchange',
  'wikipedia',
  'reddit',
  'rss',
  'pastebin',
];
