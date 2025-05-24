/**
 * Core data model for unified timeline events
 */

import { DateTime } from 'luxon';

// Supported platforms for event ingestion
export type Platform = 'twitter' | 'reddit' | 'github' | 'rss' | 'pastebin';

// Event categories for classification
export type EventCategory = 
  | 'post' | 'comment' | 'share' | 'reaction'
  | 'code_commit' | 'code_create' | 'code_push' | 'code_pr'
  | 'blog_post' | 'article'
  | 'paste' | 'snippet'
  | 'other';

// Entity types for NLP extraction
export type EntityType = 'person' | 'organization' | 'place' | 'date' | 'url' | 'email' | 'hashtag' | 'mention';

// Sentiment analysis score type
export interface SentimentScore {
  /** Overall sentiment score (-1.0 to 1.0) */
  score: number;
  
  /** Primary sentiment (positive, negative, neutral) */
  label: string;
}

// Extracted entity from content
export interface Entity {
  /** Entity text as it appears in content */
  value: string;
  
  /** Entity type classification */
  type: EntityType;
  
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  
  /** Entity metadata (varies by type) */
  metadata?: Record<string, any>;
}

// Geographic location data
export interface GeoLocation {
  /** Latitude coordinate */
  lat: number;
  
  /** Longitude coordinate */
  lng: number;
  
  /** Location name or description */
  name?: string;
  
  /** Address components */
  address?: string;
  
  /** ISO country code */
  countryCode?: string;
}

// Media attachment in event
export interface MediaAttachment {
  /** Media type */
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  
  /** URL to media */
  url: string;
  
  /** Alt text or description */
  description?: string;
  
  /** Media dimensions if applicable */
  dimensions?: {
    width: number;
    height: number;
  };
  
  /** Media metadata */
  metadata?: Record<string, any>;
}

// Social engagement metrics
export interface SocialMetrics {
  /** Number of likes/upvotes */
  likes?: number;
  
  /** Number of shares/retweets */
  shares?: number;
  
  /** Number of comments/replies */
  comments?: number;
  
  /** Number of views/impressions */
  views?: number;
  
  /** Other platform-specific metrics */
  [key: string]: number | undefined;
}

// Relations between events and other entities
export interface Relation {
  /** Type of relation */
  type: 'reply_to' | 'quote' | 'reference' | 'thread' | 'other';
  
  /** Target entity ID */
  targetId: string;
  
  /** Additional context */
  context?: string;
}

// Enhanced unified timeline event interface
export interface TimelineEvent {
  /** Unique identifier for the event */
  id: string;
  
  /** Source platform where event originated */
  platform: Platform;
  
  /** Categorized event type */
  category: EventCategory;
  
  /** Normalized timestamp in target timezone */
  timestamp: DateTime;
  
  /** Original timestamp from source */
  originalTimestamp: string;
  
  /** Event title or summary */
  title: string;
  
  /** Full event content/description */
  content: string;
  
  /** Direct link to original event */
  url: string;
  
  /** Username/handle associated with event */
  username: string;
  
  /** Geographic location data if available */
  location?: GeoLocation;
  
  /** Media attachments (images, videos, etc.) */
  media?: MediaAttachment[];
  
  /** Extracted named entities from content */
  entities?: Entity[];
  
  /** Sentiment analysis result */
  sentiment?: SentimentScore;
  
  /** Social engagement metrics */
  metrics?: SocialMetrics;
  
  /** Relations to other events or content */
  relations?: Relation[];
  
  /** Event topics based on content analysis */
  topics?: string[];
  
  /** Language of the content (ISO code) */
  language?: string;
  
  /** Additional platform-specific metadata */
  metadata: Record<string, any>;
}

// Input configuration for timeline building
export interface TimelineConfig {
  /** Target username, email, or hashtag */
  target: string;
  
  /** Target timezone for normalization (e.g., 'America/New_York') */
  timezone: string;
  
  /** Date range for event collection */
  dateRange?: {
    start: DateTime;
    end: DateTime;
  };
  
  /** Platforms to include in timeline */
  platforms: Platform[];
  
  /** Output format preferences */
  output: {
    markdown?: boolean;
    html?: boolean;
    json?: boolean;
    csv?: boolean;
    outputDir?: string;
  };
  
  /** Analysis and enrichment options */
  analysis?: {
    /** Enable sentiment analysis */
    sentiment?: boolean;
    
    /** Enable entity extraction */
    entities?: boolean;
    
    /** Enable topic modeling */
    topics?: boolean;
    
    /** Enable geo-tagging */
    geotagging?: boolean;
    
    /** Enable network analysis */
    network?: boolean;
    
    /** Custom NLP model configurations */
    nlpModels?: Record<string, any>;
  };
  
  /** Visualization preferences */
  visualization?: {
    /** Timeline theme */
    theme?: 'default' | 'dark' | 'light' | 'minimal' | 'colorful';
    
    /** Custom CSS URL */
    customCss?: string;
    
    /** Interactive features to enable */
    interactive?: {
      /** Enable filtering UI */
      filtering?: boolean;
      
      /** Enable search box */
      search?: boolean;
      
      /** Enable clustering of similar events */
      clustering?: boolean;
      
      /** Enable map view for geo events */
      map?: boolean;
    };
  };
  
  /** Dashboard options */
  dashboard?: {
    /** Enable dashboard generation */
    enabled?: boolean;
    
    /** Dashboard refresh interval (in seconds) */
    refreshInterval?: number;
    
    /** Include charts and visualizations */
    charts?: {
      /** Activity heatmap */
      activityHeatmap?: boolean;
      
      /** Platform distribution */
      platformDistribution?: boolean;
      
      /** Sentiment trends */
      sentimentTrends?: boolean;
      
      /** Topic distribution */
      topicDistribution?: boolean;
      
      /** Entity network graph */
      entityNetwork?: boolean;
    };
  };
}

// Grouped timeline events by date
export interface GroupedTimelineEvents {
  [dateKey: string]: {
    date: DateTime;
    events: TimelineEvent[];
  };
}

// Timeline statistics and insights
export interface TimelineStats {
  /** Total number of events */
  totalEvents: number;
  
  /** Events per platform */
  platforms: Record<Platform, number>;
  
  /** Events per category */
  categories: Record<string, number>;
  
  /** Overall date range */
  dateRange: {
    start: DateTime | null;
    end: DateTime | null;
  };
  
  /** Most active periods */
  activityByTime?: {
    hourOfDay: Record<string, number>;
    dayOfWeek: Record<string, number>;
    byMonth: Record<string, number>;
  };
  
  /** Entity statistics */
  entities?: {
    /** Top mentioned entities by type */
    byType: Record<EntityType, {name: string, count: number}[]>;
    
    /** Co-occurrence patterns */
    cooccurrences: {source: string, target: string, weight: number}[];
  };
  
  /** Topic analysis */
  topics?: {
    /** Top topics by frequency */
    topTopics: {topic: string, count: number}[];
    
    /** Topic trends over time */
    trends: Record<string, {date: string, count: number}[]>;
  };
  
  /** Sentiment overview */
  sentiment?: {
    /** Average sentiment score */
    average: number;
    
    /** Sentiment distribution */
    distribution: Record<'positive' | 'negative' | 'neutral', number>;
    
    /** Sentiment trends over time */
    trends: {date: string, score: number}[];
  };
}

// Platform-specific configuration interfaces
export interface TwitterConfig {
  bearerToken?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  /** Enable advanced features (user network, reply chains) */
  advancedFeatures?: boolean;
}

export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  userAgent?: string;
  /** Include comment threads */
  includeComments?: boolean;
  /** Maximum depth for comment threads */
  maxCommentDepth?: number;
}

export interface GitHubConfig {
  token?: string;
  username?: string;
  /** Include repository details */
  includeRepoDetails?: boolean;
  /** Include code snippets */
  includeCodeSnippets?: boolean;
}

export interface RSSConfig {
  feedUrls?: string[];
  customHeaders?: Record<string, string>;
  /** Auto-discover related feeds */
  autoDiscover?: boolean;
  /** Extract full content */
  extractFullContent?: boolean;
}

export interface PastebinConfig {
  apiKey?: string;
  username?: string;
  /** Include paste content */
  includePasteContent?: boolean;
  /** Filter by syntax */
  syntaxFilters?: string[];
}

// New platform configs

export interface LinkedInConfig {
  accessToken?: string;
  /** Include profile information */
  includeProfile?: boolean;
  /** Include company updates */
  includeCompanyUpdates?: boolean;
}

export interface StackOverflowConfig {
  apiKey?: string;
  /** Include answers */
  includeAnswers?: boolean;
  /** Include comments */
  includeComments?: boolean;
}

export interface HackerNewsConfig {
  /** Include comments */
  includeComments?: boolean;
  /** Maximum comment depth */
  maxCommentDepth?: number;
}

export interface MediumConfig {
  accessToken?: string;
  /** Include responses */
  includeResponses?: boolean;
}

// Combined platform configurations
export interface PlatformConfigs {
  twitter?: TwitterConfig;
  reddit?: RedditConfig;
  github?: GitHubConfig;
  rss?: RSSConfig;
  pastebin?: PastebinConfig;
  linkedin?: LinkedInConfig;
  stackoverflow?: StackOverflowConfig;
  hackernews?: HackerNewsConfig;
  medium?: MediumConfig;
}

// NLP analysis configuration
export interface NLPConfig {
  /** Language detection options */
  languageDetection?: {
    enabled: boolean;
    minConfidence?: number;
  };
  
  /** Entity extraction options */
  entityExtraction?: {
    enabled: boolean;
    types?: EntityType[];
    minConfidence?: number;
  };
  
  /** Sentiment analysis options */
  sentimentAnalysis?: {
    enabled: boolean;
    model?: 'basic' | 'advanced';
  };
  
  /** Topic modeling options */
  topicModeling?: {
    enabled: boolean;
    numTopics?: number;
    minRelevance?: number;
  };
  
  /** Keyword extraction options */
  keywordExtraction?: {
    enabled: boolean;
    maxKeywords?: number;
    minRelevance?: number;
  };
}

// Network analysis configuration
export interface NetworkConfig {
  /** Enable network graph generation */
  enabled: boolean;
  
  /** Network relation types to analyze */
  relationTypes?: ('mention' | 'reply' | 'quote' | 'cooccurrence')[];
  
  /** Minimum weight/frequency for included edges */
  minEdgeWeight?: number;
  
  /** Community detection algorithm */
  communityDetection?: 'louvain' | 'leiden' | 'fastgreedy';
}

// Visualization settings
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

// Dashboard configuration
export interface DashboardConfig {
  /** Enable dashboard generation */
  enabled: boolean;
  
  /** Dashboard title */
  title?: string;
  
  /** Dashboard refresh interval (in seconds) */
  refreshInterval?: number;
  
  /** Charts to include */
  charts: {
    /** Activity heatmap */
    activityHeatmap?: boolean;
    
    /** Platform distribution */
    platformDistribution?: boolean;
    
    /** Sentiment trends */
    sentimentTrends?: boolean;
    
    /** Topic distribution */
    topicDistribution?: boolean;
    
    /** Entity network graph */
    entityNetwork?: boolean;
  };
}

// Data export options
export interface ExportConfig {
  /** Output formats */
  formats: {
    markdown?: boolean;
    html?: boolean;
    json?: boolean;
    csv?: boolean;
  };
  
  /** Output directory */
  outputDir: string;
  
  /** File naming template */
  fileNameTemplate?: string;
  
  /** Split output by date range */
  splitByDate?: boolean;
}