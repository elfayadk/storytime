/**
 * Reddit API ingester using snoowrap
 * Fetches posts, comments, and user activity
 */

import { DateTime } from 'luxon';
import { TimelineEvent, RedditConfig } from '../types/types';
import Snoowrap from 'snoowrap';

interface RedditAward {
  name: string;
  description: string;
  count: number;
  icon_url: string;
}

interface MediaAttachment {
  type: 'image' | 'video' | 'other';
  url: string;
  thumbnail?: string;
}

export class RedditIngester {
  private client: Snoowrap;
  private config: RedditConfig;

  constructor(config: RedditConfig) {
    this.config = config;
    
    if (!config.clientId || !config.clientSecret || !config.userAgent) {
      throw new Error('Reddit client configuration is incomplete');
    }
    
    this.client = new Snoowrap({
      userAgent: config.userAgent,
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
   * Ingest Reddit activity for a given username or subreddit
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      // Check if target is a subreddit
      if (target.startsWith('r/')) {
        const posts = await this.getSubredditPosts(target.replace(/^r\//, ''), dateRange);
        events.push(...posts);
      } else {
        // Handle user activity
        const cleanUsername = target.replace(/^u\//, '');
        const posts = await this.getUserPosts(cleanUsername, dateRange);
        events.push(...posts);
        
        const comments = await this.getUserComments(cleanUsername, dateRange);
        events.push(...comments);
      }
    } catch (error) {
      console.error(`Reddit ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Get posts from a subreddit
   */
  private async getSubredditPosts(
    subreddit: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const sub = await this.client.getSubreddit(subreddit);
      const posts = await sub.getNew({ limit: 100 });
      
      for (const post of posts) {
        const postTime = DateTime.fromSeconds(post.created_utc);
        
        // Skip if outside date range
        if (dateRange && (postTime < dateRange.start || postTime > dateRange.end)) {
          continue;
        }

        // Extract media attachments
        const media = this.extractMediaFromPost(post);
        
        events.push({
          id: `reddit-post-${post.id}`,
          platform: 'reddit',
          category: 'post',
          timestamp: postTime,
          originalTimestamp: postTime.toISO()!,
          title: post.title,
          content: post.selftext || post.url || '',
          url: `https://reddit.com${post.permalink}`,
          username: post.author.name,
          media,
          metadata: {
            postId: post.id,
            subreddit: post.subreddit.display_name,
            score: post.score,
            numComments: post.num_comments,
            isVideo: post.is_video,
            postType: post.selftext ? 'text' : 'link',
            flair: post.link_flair_text,
            awards: this.extractAwards(post),
            isNSFW: post.over_18,
            isSpoiler: post.spoiler,
            isPinned: post.pinned,
            isLocked: post.locked
          }
        });

        // Get comment thread if enabled
        if (this.config.includeComments) {
          const comments = await this.getCommentThread(post, this.config.maxCommentDepth || 3);
          events.push(...comments);
        }
      }
    } catch (error) {
      console.error(`Failed to get subreddit posts: ${error}`);
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

        // Extract media attachments
        const media = this.extractMediaFromPost(post);
        
        events.push({
          id: `reddit-post-${post.id}`,
          platform: 'reddit',
          category: 'post',
          timestamp: postTime,
          originalTimestamp: postTime.toISO()!,
          title: post.title,
          content: post.selftext || post.url || '',
          url: `https://reddit.com${post.permalink}`,
          username,
          media,
          metadata: {
            postId: post.id,
            subreddit: post.subreddit.display_name,
            score: post.score,
            numComments: post.num_comments,
            isVideo: post.is_video,
            postType: post.selftext ? 'text' : 'link',
            flair: post.link_flair_text,
            awards: this.extractAwards(post),
            isNSFW: post.over_18,
            isSpoiler: post.spoiler,
            isPinned: post.pinned,
            isLocked: post.locked
          }
        });

        // Get comment thread if enabled
        if (this.config.includeComments) {
          const comments = await this.getCommentThread(post, this.config.maxCommentDepth || 3);
          events.push(...comments);
        }
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
          username,
          metadata: {
            commentId: comment.id,
            subreddit: comment.subreddit.display_name,
            score: comment.score,
            parentId: comment.parent_id,
            linkId: comment.link_id,
            isEdited: comment.edited,
            awards: this.extractAwards(comment),
            isStickied: comment.stickied,
            isSubmitter: comment.is_submitter,
            depth: comment.depth
          }
        });
      }
    } catch (error) {
      console.error(`Failed to get Reddit comments: ${error}`);
    }

    return events;
  }

  /**
   * Get full comment thread for a post
   */
  private async getCommentThread(
    post: any,
    maxDepth: number
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const comments = await post.comments.fetchAll();
      await this.processComments(comments, events, maxDepth, 0);
    } catch (error) {
      console.error(`Failed to get comment thread: ${error}`);
    }

    return events;
  }

  /**
   * Recursively process comments
   */
  private async processComments(
    comments: any[],
    events: TimelineEvent[],
    maxDepth: number,
    currentDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    for (const comment of comments) {
      const commentTime = DateTime.fromSeconds(comment.created_utc);
      
      events.push({
        id: `reddit-comment-${comment.id}`,
        platform: 'reddit',
        category: 'comment',
        timestamp: commentTime,
        originalTimestamp: commentTime.toISO()!,
        title: `Comment in thread`,
        content: comment.body,
        url: `https://reddit.com${comment.permalink}`,
        username: comment.author.name,
        metadata: {
          commentId: comment.id,
          subreddit: comment.subreddit.display_name,
          score: comment.score,
          parentId: comment.parent_id,
          linkId: comment.link_id,
          isEdited: comment.edited,
          awards: this.extractAwards(comment),
          isStickied: comment.stickied,
          isSubmitter: comment.is_submitter,
          depth: currentDepth
        }
      });

      // Process replies
      if (comment.replies && comment.replies.length > 0) {
        await this.processComments(comment.replies, events, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * Extract media attachments from a post
   */
  private extractMediaFromPost(post: any): MediaAttachment[] {
    const media: MediaAttachment[] = [];

    // Handle direct image/video uploads
    if (post.is_video && post.media?.reddit_video) {
      media.push({
        type: 'video',
        url: post.media.reddit_video.fallback_url,
        thumbnail: post.thumbnail
      });
    } else if (post.is_reddit_media_domain && post.url) {
      media.push({
        type: 'image',
        url: post.url,
        thumbnail: post.thumbnail !== 'self' ? post.thumbnail : undefined
      });
    }
    // Handle external links
    else if (post.url && !post.is_self) {
      media.push({
        type: 'other',
        url: post.url,
        thumbnail: post.thumbnail !== 'self' ? post.thumbnail : undefined
      });
    }

    return media;
  }

  /**
   * Extract awards from a post or comment
   */
  private extractAwards(item: any): RedditAward[] {
    if (!item.all_awardings) return [];

    return item.all_awardings.map((award: any) => ({
      name: award.name,
      description: award.description,
      count: award.count,
      icon_url: award.icon_url
    }));
  }
}