/**
 * GitHub API ingester using REST API
 * Fetches commits, pull requests, issues, and repository events
 */

import axios from 'axios';
import { DateTime } from 'luxon';
import { TimelineEvent, GitHubConfig, EventCategory } from './types.js';

export class GitHubIngester {
  private config: GitHubConfig;
  private apiClient;

  constructor(config: GitHubConfig) {
    this.config = config;
    
    this.apiClient = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'timeline-builder/1.0.0',
        ...(config.token && { 'Authorization': `token ${config.token}` })
      }
    });
  }

  /**
   * Test connection to GitHub API
   */
  async testConnection(): Promise<void> {
    try {
      await this.apiClient.get('/user');
    } catch (error) {
      throw new Error(`GitHub API connection failed: ${error}`);
    }
  }

  /**
   * Ingest GitHub activity for a given username
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      const username = target.replace('@', '');
      
      // Get user's public events
      const userEvents = await this.getUserEvents(username, dateRange);
      events.push(...userEvents);
      
      // Get user's repositories and recent commits
      const repoEvents = await this.getRepositoryEvents(username, dateRange);
      events.push(...repoEvents);

    } catch (error) {
      console.error(`GitHub ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Get user's public events from GitHub Events API
   */
  private async getUserEvents(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      const response = await this.apiClient.get(`/users/${username}/events/public`);
      
      for (const event of response.data) {
        const eventTime = DateTime.fromISO(event.created_at);
        
        // Skip if outside date range
        if (dateRange && (eventTime < dateRange.start || eventTime > dateRange.end)) {
          continue;
        }
        
        const timelineEvent = this.classifyGitHubEvent(event, username);
        if (timelineEvent) {
          events.push(timelineEvent);
        }
      }
    } catch (error) {
      console.error(`Failed to get GitHub user events: ${error}`);
    }

    return events;
  }

  /**
   * Get repository events and commits
   */
  private async getRepositoryEvents(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Get user's repositories
      const reposResponse = await this.apiClient.get(`/users/${username}/repos`, {
        params: { sort: 'updated', per_page: 50 }
      });
      
      // Get recent commits from each repo
      for (const repo of reposResponse.data) {
        try {
          const commitsResponse = await this.apiClient.get(
            `/repos/${repo.full_name}/commits`,
            { 
              params: { 
                author: username,
                per_page: 20,
                ...(dateRange && {
                  since: dateRange.start.toISO(),
                  until: dateRange.end.toISO()
                })
              } 
            }
          );
          
          for (const commit of commitsResponse.data) {
            const commitTime = DateTime.fromISO(commit.commit.author.date);
            
            events.push({
              id: `github-commit-${commit.sha}`,
              platform: 'github',
              category: 'code_commit',
              timestamp: commitTime,
              originalTimestamp: commit.commit.author.date,
              title: `Commit to ${repo.name}`,
              content: commit.commit.message,
              url: commit.html_url,
              username: username,
              metadata: {
                sha: commit.sha,
                repository: repo.full_name,
                repositoryUrl: repo.html_url,
                additions: commit.stats?.additions,
                deletions: commit.stats?.deletions,
                filesChanged: commit.files?.length
              }
            });
          }
        } catch (repoError) {
          // Skip repos that are private or inaccessible
          continue;
        }
      }
    } catch (error) {
      console.error(`Failed to get repository events: ${error}`);
    }

    return events;
  }

  /**
   * Classify GitHub events into timeline events
   */
  private classifyGitHubEvent(event: any, username: string): TimelineEvent | null {
    const eventTime = DateTime.fromISO(event.created_at);
    let category: EventCategory = 'other';
    let title = '';
    let content = '';

    switch (event.type) {
      case 'CreateEvent':
        category = 'code_create';
        title = `Created ${event.payload.ref_type}: ${event.payload.ref || event.repo.name}`;
        content = `Created a new ${event.payload.ref_type} in ${event.repo.name}`;
        break;
        
      case 'PushEvent':
        category = 'code_push';
        title = `Pushed to ${event.repo.name}`;
        content = `Pushed ${event.payload.commits?.length || 0} commits to ${event.payload.ref}`;
        break;
        
      case 'PullRequestEvent':
        category = 'code_pr';
        title = `${event.payload.action} pull request in ${event.repo.name}`;
        content = event.payload.pull_request?.title || '';
        break;
        
      case 'IssuesEvent':
        category = 'post';
        title = `${event.payload.action} issue in ${event.repo.name}`;
        content = event.payload.issue?.title || '';
        break;
        
      case 'ForkEvent':
        category = 'code_create';
        title = `Forked ${event.repo.name}`;
        content = `Forked repository to ${event.payload.forkee?.full_name}`;
        break;
        
      case 'WatchEvent':
        category = 'reaction';
        title = `Starred ${event.repo.name}`;
        content = `Starred the repository ${event.repo.name}`;
        break;
        
      default:
        return null; // Skip unsupported event types
    }

    return {
      id: `github-${event.type}-${event.id}`,
      platform: 'github',
      category,
      timestamp: eventTime,
      originalTimestamp: event.created_at,
      title,
      content,
      url: `https://github.com/${event.repo.name}`,
      username: username,
      metadata: {
        eventType: event.type,
        repository: event.repo.name,
        repositoryUrl: `https://github.com/${event.repo.name}`,
        payload: event.payload
      }
    };
  }
}