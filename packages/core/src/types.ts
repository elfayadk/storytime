/**
 * Core data model for unified timeline events.
 * Ported from Storytime v1 (proven shape) and extended for the free/OSS platform set.
 */
import type { DateTime } from 'luxon';

/** Supported platforms for event ingestion. All free, no paid key. */
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
  | 'stackexchange'
  | 'medium'
  | 'lemmy'
  | 'npm'
  | 'youtube';

export const PLATFORMS: Platform[] = [
  'github',
  'reddit',
  'rss',
  'mastodon',
  'bluesky',
  'pastebin',
  'hackernews',
  'devto',
  'gitlab',
  'wikipedia',
  'stackexchange',
  'medium',
  'lemmy',
  'npm',
  'youtube',
];

/** Event categories for classification. */
export type EventCategory =
  | 'post'
  | 'comment'
  | 'share'
  | 'reaction'
  | 'code_commit'
  | 'code_create'
  | 'code_push'
  | 'code_pr'
  | 'code_issue'
  | 'blog_post'
  | 'article'
  | 'paste'
  | 'snippet'
  | 'other';

/** Entity types for NLP extraction. */
export type EntityType =
  | 'person'
  | 'organization'
  | 'place'
  | 'date'
  | 'url'
  | 'email'
  | 'hashtag'
  | 'mention';

export interface SentimentScore {
  /** Overall sentiment score (-1.0 to 1.0). */
  score: number;
  /** Primary sentiment label. */
  label: 'positive' | 'negative' | 'neutral';
}

export interface Entity {
  value: string;
  type: EntityType;
  /** Confidence (0..1). */
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  countryCode?: string;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  url: string;
  description?: string;
  dimensions?: { width: number; height: number };
  metadata?: Record<string, unknown>;
}

export interface SocialMetrics {
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  [key: string]: number | undefined;
}

export interface Relation {
  type: 'reply_to' | 'quote' | 'reference' | 'thread' | 'mention' | 'other';
  targetId: string;
  context?: string;
}

/** Unified timeline event - the backbone of the whole system. */
export interface TimelineEvent {
  id: string;
  platform: Platform;
  category: EventCategory;
  /** Normalized timestamp (luxon DateTime, target timezone). */
  timestamp: DateTime;
  /** Original raw timestamp string from the source. */
  originalTimestamp: string;
  title: string;
  content: string;
  url: string;
  username: string;
  location?: GeoLocation;
  media?: MediaAttachment[];
  entities?: Entity[];
  sentiment?: SentimentScore;
  metrics?: SocialMetrics;
  relations?: Relation[];
  topics?: string[];
  /** Optional AI-generated one-line summary (Ollama). */
  summary?: string;
  language?: string;
  metadata: Record<string, unknown>;
}

/** A serializable event (timestamp as ISO string) for JSON/API/DB boundaries. */
export type SerializedEvent = Omit<TimelineEvent, 'timestamp'> & {
  timestamp: string;
};

/** Interaction graph derived from events. */
export interface GraphNode {
  id: string;
  label: string;
  platform?: Platform;
  weight: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  type: Relation['type'];
  weight: number;
}
export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TimelineStats {
  totalEvents: number;
  byPlatform: Record<string, number>;
  byCategory: Record<string, number>;
  byDay: Record<string, number>;
  sentiment: { positive: number; negative: number; neutral: number };
  topEntities: { value: string; type: EntityType; count: number }[];
  topTopics: { topic: string; count: number }[];
  dateRange: { start: string | null; end: string | null };
}

/** Temporal anomaly / change-point insight. */
export interface Insight {
  type: 'burst' | 'sentiment_shift' | 'quiet';
  date: string;
  score: number;
  detail: string;
}

/** A semantic cluster of events (theme). */
export interface ClusterSummary {
  id: number;
  label: string;
  size: number;
  keywords: string[];
  eventIds: string[];
  /** Optional AI one-line description of the theme. */
  summary?: string;
}

/** When an account is active: derived rhythm over hour-of-day and weekday. */
export interface ActivityRhythm {
  byHour: number[]; // length 24, counts per hour (UTC of the result timezone)
  byWeekday: number[]; // length 7, 0 = Sunday
  /** Joint distribution: grid[weekday 0..6][hour 0..23]. */
  grid: number[][];
  peakHour: number;
  peakWeekday: number;
  /** Contiguous most-active window, e.g. { startHour: 14, endHour: 22 }. */
  activeWindow: { startHour: number; endHour: number };
  /** Human summary, e.g. "most active 14:00 to 22:00, quietest overnight". */
  summary: string;
  total: number;
}

/** A normalized public profile for the subject (GitHub / GitLab). */
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

/** A bi-temporal fact extracted from events: what was true, when, and from where. */
export interface Fact {
  id: string;
  subject: string;
  subjectKind: 'person' | 'org' | 'project' | 'place' | 'topic';
  predicate: string;
  object?: string;
  objectKind?: string;
  /** Valid time: when it was true in the world. */
  validFrom: string;
  validTo?: string;
  /** Transaction time: when Storytime learned it. */
  ingestedAt: string;
  confidence: number;
  stance: 'asserted' | 'reported' | 'questioned' | 'denied';
  extractor: string; // 'rule' | 'ollama:<model>'
  evidence: { eventId: string; url: string; quote?: string }[];
  invalidatedAt?: string;
}

/** A story arc: a theme unfolding over time, grouping related events. */
export interface StoryArc {
  id: number;
  label: string;
  from: string;
  to: string;
  size: number;
  eventIds: string[];
  narrative?: string;
  keyMoments: { date: string; title: string; url: string }[];
}

export interface TimelineResult {
  target: string;
  generatedAt: string;
  /** Subject profile card, when resolvable. */
  profile?: Profile;
  /** Bi-temporal facts extracted from the events. */
  facts?: Fact[];
  /** Story arcs (themes over time). */
  arcs?: StoryArc[];
  /** AI-written intelligence brief (Ollama), when enabled and reachable. */
  brief?: string;
  events: TimelineEvent[];
  stats: TimelineStats;
  graph: NetworkGraph;
  /** Derived activity rhythm (active hours / days). */
  rhythm?: ActivityRhythm;
  /** Optional AI narrative over the whole timeline. */
  narrative?: string;
  /** Temporal bursts / sentiment shifts. */
  insights?: Insight[];
  /** Semantic theme clusters. */
  clusters?: ClusterSummary[];
  /** Which embedding engine was used ('ollama' | 'transformers' | 'hashed'). */
  embeddingProvider?: string;
  /** Embedding dimension (for the vector store). */
  embeddingDim?: number;
  /**
   * Per-event embeddings (eventId → vector). Kept in memory and persisted to the
   * vector store by the server; STRIPPED from file exports to keep them lean.
   */
  embeddings?: Record<string, number[]>;
}
