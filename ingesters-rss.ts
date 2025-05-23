/**
 * RSS/Blog ingester using rss-parser
 * Fetches blog posts and RSS feed entries
 */

import Parser from 'rss-parser';
import axios from 'axios';
import { DateTime } from 'luxon';
import { TimelineEvent, RSSConfig } from './types.js';

export class RSSIngester {
  private parser: Parser;
  private config: RSSConfig;

  constructor(config: RSSConfig) {
    this.config = config;
    this.parser = new Parser({
      customFields: {
        item: ['author', 'creator', 'dc:creator', 'content:encoded']
      },
      headers: config.customHeaders || {}
    });
  }

  /**
   * Test connection by attempting to parse a common RSS feed
   */
  async testConnection(): Promise<void> {
    try {
      // Test with a simple feed
      await this.parser.parseURL('https://feeds.feedburner.com/oreilly/radar');
    } catch (error) {
      throw new Error(`RSS parser test failed: ${error}`);
    }
  }

  /**
   * Ingest RSS feeds and blog posts for a given target
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      // If target looks like a URL, treat it as an RSS feed
      if (target.startsWith('http')) {
        const feedEvents = await this.parseFeed(target, dateRange);
        events.push(...feedEvents);
      } else {
        // Otherwise, search for feeds related to the target
        const discoveredFeeds = await this.discoverFeeds(target);
        
        for (const feedUrl of discoveredFeeds) {
          try {
            const feedEvents = await this.parseFeed(feedUrl, dateRange);
            events.push(...feedEvents);
          } catch (feedError) {
            console.warn(`Failed to parse feed ${feedUrl}: ${feedError}`);
          }
        }
      }
    } catch (error) {
      console.error(`RSS ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Parse a single RSS feed
   */
  private async parseFeed(
    feedUrl: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const feed = await this.parser.parseURL(feedUrl);
      
      for (const item of feed.items) {
        if (!item.pubDate) continue;
        
        const pubTime = DateTime.fromJSDate(new Date(item.pubDate));
        
        // Skip if outside date range
        if (dateRange && (pubTime < dateRange.start || pubTime > dateRange.end)) {
          continue;
        }
        
        // Extract author information
        const author = item.author || 
                      item.creator || 
                      item['dc:creator'] || 
                      feed.title || 
                      'Unknown';
        
        // Extract content
        const content = item['content:encoded'] || 
                       item.contentSnippet || 
                       item.content || 
                       item.summary || 
                       '';
        
        events.push({
          id: `rss-${this.generateId(item.link || item.guid || item.title || '')}`,
          platform: 'rss',
          category: 'blog_post',
          timestamp: pubTime,
          originalTimestamp: item.pubDate,
          title: item.title || 'Untitled Post',
          content: content.substring(0, 1000), // Truncate very long content
          url: item.link || feedUrl,
          username: author,
          metadata: {
            feedTitle: feed.title,
            feedUrl: feedUrl,
            guid: item.guid,
            categories: item.categories || [],
            contentLength: content.length
          }
        });
      }
    } catch (error) {
      console.error(`Failed to parse RSS feed ${feedUrl}: ${error}`);
    }

    return events;
  }

  /**
   * Discover RSS feeds related to a target (basic implementation)
   */
  private async discoverFeeds(target: string): Promise<string[]> {
    const feeds: string[] = [];
    
    // Use predefined feed URLs or configured feeds
    if (this.config.feedUrls) {
      feeds.push(...this.config.feedUrls);
    }
    
    // Try common RSS feed patterns for the target
    const commonPatterns = [
      `https://${target}.wordpress.com/feed/`,
      `https://${target}.blogspot.com/feeds/posts/default`,
      `https://${target}.medium.com/feed`,
      `https://${target}.ghost.io/rss/`,
      `https://feeds.feedburner.com/${target}`
    ];
    
    for (const pattern of commonPatterns) {
      try {
        // Test if the feed exists by making a HEAD request
        const response = await axios.head(pattern, { timeout: 5000 });
        if (response.status === 200) {
          feeds.push(pattern);
        }
      } catch (error) {
        // Feed doesn't exist or isn't accessible, skip
        continue;
      }
    }
    
    return feeds;
  }

  /**
   * Generate a simple ID from a string
   */
  private generateId(input: string): string {
    return input.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) + 
           Math.abs(this.simpleHash(input)).toString();
  }

  /**
   * Simple hash function for ID generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}