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

// Unified timeline event interface
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
    outputDir?: string;
  };
}

// Grouped timeline events by date
export interface GroupedTimelineEvents {
  [dateKey: string]: {
    date: DateTime;
    events: TimelineEvent[];
  };
}

// Platform-specific configuration interfaces
export interface TwitterConfig {
  bearerToken?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  userAgent?: string;
}

export interface GitHubConfig {
  token?: string;
  username?: string;
}

export interface RSSConfig {
  feedUrls?: string[];
  customHeaders?: Record<string, string>;
}

export interface PastebinConfig {
  apiKey?: string;
  username?: string;
}

// Combined platform configurations
export interface PlatformConfigs {
  twitter?: TwitterConfig;
  reddit?: RedditConfig;
  github?: GitHubConfig;
  rss?: RSSConfig;
  pastebin?: PastebinConfig;
}