/**
 * Reddit API ingester using snoowrap
 * Fetches posts, comments, and user activity
 */

import snoowrap from 'snoowrap';
import { DateTime } from 'luxon';
import { TimelineEvent, RedditConfig } from './types.js';

export class RedditIngester {
  private client: snoowrap;
  private config: RedditConfig;

  constructor(config: RedditConfig) {
    this.config = config;
    
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Reddit Client ID and Secret are required');
    }
    
    this.client = new snoowrap({
      userAgent: config.userAgent || 'timeline-builder/1.0.0',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password
    });
  }

  /**
   * Test connection to Reddit API
   */
  async testConnection(): Promise<void> {
    try {
      await this.client.getMe();
    } catch (error) {
      throw new Error(`Reddit API connection failed: ${error}`);
    }
  }

  /**
   * Ingest Reddit activity for a given username
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      // Remove u/ if present
      const cleanUsername = target.replace(/^u\//, '');
      
      // Get user's posts
      const posts = await this.getUserPosts(cleanUsername, dateRange);
      events.push(...posts);
      
      // Get user's comments
      const comments = await this.getUserComments(cleanUsername, dateRange);
      events.push(...comments);

    } catch (error) {
      console.error(`Reddit ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Get user's submitted posts
   */
  private async getUserPosts(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const user = await this.client.getUser(username);
      const submissions = await user.getSubmissions({ limit: 100 });
      
      for (const post of submissions) {
        const postTime = DateTime.fromSeconds(post.created_utc);
        
        // Skip if outside date range
        if (dateRange && (postTime < dateRange.start || postTime > dateRange.end)) {
          continue;
        }
        
        events.push({
          id: `reddit-post-${post.id}`,
          platform: 'reddit',
          category: 'post',
          timestamp: postTime,
          originalTimestamp: postTime.toISO()!,
          title: post.title,
          content: post.selftext || post.url || '',
          url: `https://reddit.com${post.permalink}`,
          username: username,
          metadata: {
            postId: post.id,
            subreddit: post.subreddit.display_name,
            score: post.score,
            numComments: post.num_comments,
            isVideo: post.is_video,
            postType: post.selftext ? 'text' : 'link'
          }
        });
      }
    } catch (error) {
      console.error(`Failed to get Reddit posts: ${error}`);
    }

    return events;
  }

  /**
   * Get user's comments
   */
  private async getUserComments(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const user = await this.client.getUser(username);
      const comments = await user.getComments({ limit: 100 });
      
      for (const comment of comments) {
        const commentTime = DateTime.fromSeconds(comment.created_utc);
        
        // Skip if outside date range
        if (dateRange && (commentTime < dateRange.start || commentTime > dateRange.end)) {
          continue;
        }
        
        events.push({
          id: `reddit-comment-${comment.id}`,
          platform: 'reddit',
          category: 'comment',
          timestamp: commentTime,
          originalTimestamp: commentTime.toISO()!,
          title: `Comment in r/${comment.subreddit.display_name}`,
          content: comment.body,
          url: `https://reddit.com${comment.permalink}`,
          username: username,
          metadata: {
            commentId: comment.id,
            subreddit: comment.subreddit.display_name,
            score: comment.score,
            parentId: comment.parent_id,
            linkId: comment.link_id
          }
        });
      }
    } catch (error) {
      console.error(`Failed to get Reddit comments: ${error}`);
    }

    return events;
  }
}