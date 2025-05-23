/**
 * Core timeline processing engine
 * Handles event ingestion, normalization, deduplication, and merging
 */

import { DateTime } from 'luxon';
import chalk from 'chalk';
import { TimelineEvent, TimelineConfig, PlatformConfigs, GroupedTimelineEvents } from './types.js';
import { TwitterIngester } from './ingesters/twitter.js';
import { RedditIngester } from './ingesters/reddit.js';
import { GitHubIngester } from './ingesters/github.js';
import { RSSIngester } from './ingesters/rss.js';
import { PastebinIngester } from './ingesters/pastebin.js';

export class TimelineProcessor {
  private config: TimelineConfig;
  private platformConfigs: PlatformConfigs;

  constructor(config: TimelineConfig, platformConfigs: PlatformConfigs) {
    this.config = config;
    this.platformConfigs = platformConfigs;
  }

  /**
   * Main timeline building orchestrator
   */
  async buildTimeline(): Promise<TimelineEvent[]> {
    console.log(chalk.blue('🔄 Starting event ingestion...'));
    
    // Collect events from all platforms
    const allEvents: TimelineEvent[] = [];
    
    for (const platform of this.config.platforms) {
      try {
        console.log(chalk.gray(`  📡 Ingesting from ${platform}...`));
        const events = await this.ingestFromPlatform(platform);
        console.log(chalk.green(`  ✅ ${platform}: ${events.length} events`));
        allEvents.push(...events);
      } catch (error) {
        console.log(chalk.red(`  ❌ ${platform}: Failed to ingest events`));
        console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    console.log(chalk.blue(`\n🔄 Processing ${allEvents.length} total events...`));

    // Normalize timestamps to target timezone
    const normalizedEvents = this.normalizeTimestamps(allEvents);
    console.log(chalk.green(`✅ Normalized timestamps to ${this.config.timezone}`));

    // Deduplicate events
    const deduplicatedEvents = this.deduplicateEvents(normalizedEvents);
    console.log(chalk.green(`✅ Deduplicated events (${allEvents.length - deduplicatedEvents.length} duplicates removed)`));

    // Sort chronologically
    const sortedEvents = this.sortEventsByTimestamp(deduplicatedEvents);
    console.log(chalk.green(`✅ Sorted ${sortedEvents.length} events chronologically`));

    return sortedEvents;
  }

  /**
   * Ingest events from a specific platform
   */
  private async ingestFromPlatform(platform: string): Promise<TimelineEvent[]> {
    switch (platform) {
      case 'twitter':
        if (this.platformConfigs.twitter) {
          const ingester = new TwitterIngester(this.platformConfigs.twitter);
          return await ingester.ingest(this.config.target, this.config.dateRange);
        }
        break;
      
      case 'reddit':
        if (this.platformConfigs.reddit) {
          const ingester = new RedditIngester(this.platformConfigs.reddit);
          return await ingester.ingest(this.config.target, this.config.dateRange);
        }
        break;
      
      case 'github':
        if (this.platformConfigs.github) {
          const ingester = new GitHubIngester(this.platformConfigs.github);
          return await ingester.ingest(this.config.target, this.config.dateRange);
        }
        break;
      
      case 'rss':
        const rssIngester = new RSSIngester(this.platformConfigs.rss || {});
        return await rssIngester.ingest(this.config.target, this.config.dateRange);
      
      case 'pastebin':
        if (this.platformConfigs.pastebin) {
          const ingester = new PastebinIngester(this.platformConfigs.pastebin);
          return await ingester.ingest(this.config.target, this.config.dateRange);
        }
        break;
    }
    
    return [];
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
   * Sort events by timestamp (chronological order)
   */
  private sortEventsByTimestamp(events: TimelineEvent[]): TimelineEvent[] {
    return events.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
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
   * Get summary statistics about the timeline
   */
  getTimelineStats(events: TimelineEvent[]) {
    const stats = {
      totalEvents: events.length,
      platforms: {} as Record<string, number>,
      categories: {} as Record<string, number>,
      dateRange: {
        start: events.length > 0 ? events[0].timestamp : null,
        end: events.length > 0 ? events[events.length - 1].timestamp : null
      }
    };

    // Count by platform and category
    for (const event of events) {
      stats.platforms[event.platform] = (stats.platforms[event.platform] || 0) + 1;
      stats.categories[event.category] = (stats.categories[event.category] || 0) + 1;
    }

    return stats;
  }
}