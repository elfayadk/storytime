/**
 * Twitter API ingester using Twitter API v2
 * Fetches tweets, replies, and user activity
 */

import { TwitterApi } from 'twitter-api-v2';
import { DateTime } from 'luxon';
import { TimelineEvent, TwitterConfig } from './types.js';

export class TwitterIngester {
  private client: TwitterApi;
  private config: TwitterConfig;

  constructor(config: TwitterConfig) {
    this.config = config;
    
    if (!config.bearerToken) {
      throw new Error('Twitter Bearer Token is required');
    }
    
    this.client = new TwitterApi(config.bearerToken);
  }

  /**
   * Test connection to Twitter API
   */
  async testConnection(): Promise<void> {
    try {
      await this.client.v2.me();
    } catch (error) {
      throw new Error(`Twitter API connection failed: ${error}`);
    }
  }

  /**
   * Ingest tweets and activity for a given username or hashtag
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      // Handle hashtag vs username
      if (target.startsWith('#')) {
        // Search for hashtag tweets
        const tweets = await this.searchHashtagTweets(target, dateRange);
        events.push(...tweets);
      } else {
        // Get user timeline
        const userTweets = await this.getUserTweets(target, dateRange);
        events.push(...userTweets);
      }
    } catch (error) {
      console.error(`Twitter ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Search for tweets containing a hashtag
   */
  private async searchHashtagTweets(
    hashtag: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const searchParams: any = {
        query: hashtag,
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id']
      };

      // Add date range if specified
      if (dateRange) {
        searchParams.start_time = dateRange.start.toISO();
        searchParams.end_time = dateRange.end.toISO();
      }

      const tweets = await this.client.v2.search(searchParams);
      
      for (const tweet of tweets.data || []) {
        const author = tweets.includes?.users?.find(u => u.id === tweet.author_id);
        
        events.push({
          id: `twitter-${tweet.id}`,
          platform: 'twitter',
          category: 'post',
          timestamp: DateTime.fromISO(tweet.created_at!),
          originalTimestamp: tweet.created_at!,
          title: `Tweet by @${author?.username || 'unknown'}`,
          content: tweet.text,
          url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
          username: author?.username || 'unknown',
          metadata: {
            tweetId: tweet.id,
            authorId: tweet.author_id,
            publicMetrics: tweet.public_metrics,
            contextAnnotations: tweet.context_annotations
          }
        });
      }
    } catch (error) {
      console.error(`Failed to search hashtag tweets: ${error}`);
    }

    return events;
  }

  /**
   * Get timeline for a specific user
   */
  private async getUserTweets(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Remove @ if present
      const cleanUsername = username.replace('@', '');
      
      // Get user info first
      const user = await this.client.v2.userByUsername(cleanUsername);
      if (!user.data) {
        throw new Error(`User ${cleanUsername} not found`);
      }

      const timelineParams: any = {
        max_results: 100,
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations'],
        exclude: ['retweets', 'replies'] // Focus on original tweets
      };

      // Add date range if specified
      if (dateRange) {
        timelineParams.start_time = dateRange.start.toISO();
        timelineParams.end_time = dateRange.end.toISO();
      }

      const timeline = await this.client.v2.userTimeline(user.data.id, timelineParams);
      
      for (const tweet of timeline.data || []) {
        events.push({
          id: `twitter-${tweet.id}`,
          platform: 'twitter',
          category: 'post',
          timestamp: DateTime.fromISO(tweet.created_at!),
          originalTimestamp: tweet.created_at!,
          title: `Tweet by @${cleanUsername}`,
          content: tweet.text,
          url: `https://twitter.com/${cleanUsername}/status/${tweet.id}`,
          username: cleanUsername,
          metadata: {
            tweetId: tweet.id,
            userId: user.data.id,
            publicMetrics: tweet.public_metrics,
            contextAnnotations: tweet.context_annotations
          }
        });
      }

    } catch (error) {
      console.error(`Failed to get user tweets: ${error}`);
    }

    return events;
  }
}