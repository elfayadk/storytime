/**
 * Twitter API ingester using Twitter API v2
 * Fetches tweets, replies, and user activity
 */

import { TwitterApi, TweetV2, Tweetv2SearchParams, TweetV2UserTimelineParams, ApiResponseError } from 'twitter-api-v2';
import { DateTime } from 'luxon';
import { TimelineEvent, TwitterConfig } from '../types/types.js';

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
      const searchParams: Tweetv2SearchParams = {
        query: hashtag,
        max_results: 100,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id'],
        ...(dateRange && {
          start_time: dateRange.start?.toISO() || undefined,
          end_time: dateRange.end?.toISO() || undefined
        })
      };

      const response = await this.client.v2.search(searchParams.query);
      const tweets = await response.fetchLast(100);
      
      if (!tweets || !tweets.data) return events;

      // Convert tweets.data to array if it's not already
      const tweetData = tweets.data as unknown as TweetV2[];
      tweetData.forEach((tweet) => {
        const author = tweets.includes?.users?.find(u => u.id === tweet.author_id);
        
        events.push({
          id: `twitter-${tweet.id}`,
          platform: 'twitter',
          category: 'post',
          timestamp: DateTime.fromISO(tweet.created_at || ''),
          originalTimestamp: tweet.created_at || '',
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
      });
    } catch (error) {
      if (error instanceof ApiResponseError) {
        console.error(`Twitter API error: ${error.message}`);
      } else {
        console.error(`Failed to search hashtag tweets: ${error}`);
      }
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

      const timelineParams: TweetV2UserTimelineParams = {
        max_results: 100,
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations'],
        exclude: ['retweets', 'replies'],
        ...(dateRange && {
          start_time: dateRange.start?.toISO() || undefined,
          end_time: dateRange.end?.toISO() || undefined
        })
      };

      const response = await this.client.v2.userTimeline(user.data.id, timelineParams);
      const tweets = await response.fetchLast(100);
      
      if (!tweets || !tweets.data) return events;

      // Convert tweets.data to array if it's not already
      const tweetData = tweets.data as unknown as TweetV2[];
      tweetData.forEach((tweet) => {
        events.push({
          id: `twitter-${tweet.id}`,
          platform: 'twitter',
          category: 'post',
          timestamp: DateTime.fromISO(tweet.created_at || ''),
          originalTimestamp: tweet.created_at || '',
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
      });

    } catch (error) {
      if (error instanceof ApiResponseError) {
        console.error(`Twitter API error: ${error.message}`);
      } else {
        console.error(`Failed to get user tweets: ${error}`);
      }
    }

    return events;
  }
}