/**
 * Core timeline processing engine
 * Handles event ingestion, normalization, deduplication, and merging
 */

import { DateTime } from 'luxon';
import chalk from 'chalk';
import { TimelineEvent, TimelineConfig, PlatformConfigs, GroupedTimelineEvents, Platform } from '../types/types.js';
import { TwitterIngester } from '../ingesters/ingesters-twitter.js';
import { RedditIngester } from '../ingesters/ingesters-reddit.js';
import { GitHubIngester } from '../ingesters/ingesters-github.js';
import { RSSIngester } from '../ingesters/ingesters-rss.js';
import { PastebinIngester } from '../ingesters/ingesters-pastebin.js';
import { NLPProcessor } from './nlp-processor.js';

export class TimelineProcessor {
  private config: TimelineConfig;
  private platformConfigs: PlatformConfigs;
  private nlpProcessor: NLPProcessor;

  constructor(config: TimelineConfig, platformConfigs: PlatformConfigs) {
    this.config = config;
    this.platformConfigs = platformConfigs;
    this.nlpProcessor = new NLPProcessor();
  }

  /**
   * Build unified timeline from all configured platforms
   */
  async buildTimeline(): Promise<TimelineEvent[]> {
    let allEvents: TimelineEvent[] = [];

    try {
      // Process each platform in parallel
      const platformPromises = this.config.platforms.map(platform => 
        this.processEvents(platform)
      );

      const results = await Promise.allSettled(platformPromises);

      // Collect successful results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allEvents = allEvents.concat(result.value);
        } else {
          console.error(`Failed to process ${this.config.platforms[index]}: ${result.reason}`);
        }
      });

      // Sort events by timestamp (most recent first)
      allEvents.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

      // Apply NLP processing if enabled
      if (this.config.analysis?.entities || this.config.analysis?.sentiment || this.config.analysis?.topics) {
        allEvents = await this.nlpProcessor.process(allEvents);
      }

    } catch (error) {
      console.error('Timeline processing failed:', error);
      throw error;
    }

    return allEvents;
  }

  /**
   * Process events for a specific platform
   */
  private async processEvents(platform: Platform): Promise<TimelineEvent[]> {
    try {
      let ingester;

      switch (platform) {
        case 'twitter':
          if (!this.platformConfigs.twitter?.bearerToken) {
            throw new Error('Twitter bearer token is required');
          }
          ingester = new TwitterIngester(this.platformConfigs.twitter);
          break;

        case 'reddit':
          if (!this.platformConfigs.reddit?.clientId || !this.platformConfigs.reddit?.clientSecret) {
            throw new Error('Reddit client ID and secret are required');
          }
          ingester = new RedditIngester(this.platformConfigs.reddit);
          break;

        case 'github':
          ingester = new GitHubIngester(this.platformConfigs.github || {});
          break;

        case 'rss':
          ingester = new RSSIngester(this.platformConfigs.rss || {});
          break;

        case 'pastebin':
          if (!this.platformConfigs.pastebin?.apiKey) {
            throw new Error('Pastebin API key is required');
          }
          ingester = new PastebinIngester(this.platformConfigs.pastebin);
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // Test connection if possible
      try {
        await ingester.testConnection();
      } catch (error) {
        console.warn(`Warning: Connection test failed for ${platform}: ${error}`);
      }

      // Ingest events
      const events = await ingester.ingest(this.config.target, this.config.dateRange);

      // Normalize timestamps to target timezone
      return events.map(event => ({
        ...event,
        timestamp: event.timestamp.setZone(this.config.timezone)
      }));

    } catch (error) {
      console.error(`Failed to process ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Get timeline statistics
   */
  getStats(events: TimelineEvent[]): Record<string, any> {
    return {
      totalEvents: events.length,
      platformCounts: events.reduce((counts, event) => {
        counts[event.platform] = (counts[event.platform] || 0) + 1;
        return counts;
      }, {} as Record<string, number>),
      dateRange: {
        start: events.length ? events[events.length - 1].timestamp : null,
        end: events.length ? events[0].timestamp : null
      },
      categoryCounts: events.reduce((counts, event) => {
        counts[event.category] = (counts[event.category] || 0) + 1;
        return counts;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Group events by date for better organization
   */
  groupEventsByDate(events: TimelineEvent[]): GroupedTimelineEvents {
    const grouped: GroupedTimelineEvents = {};

    for (const event of events) {
      const dateKey = event.timestamp.toISODate();
      if (!dateKey) continue;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: event.timestamp.startOf('day'),
          events: []
        };
      }

      grouped[dateKey].events.push(event);
    }

    return grouped;
  }

  /**
   * Simple hash function for content deduplication
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Deduplicate events based on content similarity and timing
   */
  private deduplicateEvents(events: TimelineEvent[]): TimelineEvent[] {
    const seen = new Set<string>();
    const deduplicated: TimelineEvent[] = [];

    for (const event of events) {
      // Create a hash based on platform, timestamp (rounded to minute), and content
      const timeKey = event.timestamp.startOf('minute').toISO();
      const contentHash = this.simpleHash(event.content.toLowerCase().trim());
      const dedupeKey = `${event.platform}-${timeKey}-${contentHash}`;

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        deduplicated.push(event);
      }
    }

    return deduplicated;
  }

  /**
   * Normalize all timestamps to the target timezone using Luxon
   */
  private normalizeTimestamps(events: TimelineEvent[]): TimelineEvent[] {
    return events.map(event => ({
      ...event,
      timestamp: event.timestamp.setZone(this.config.timezone)
    }));
  }

  /**
   * Sort events by timestamp (chronological order)
   */
  private sortEventsByTimestamp(events: TimelineEvent[]): TimelineEvent[] {
    return events.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  }
}