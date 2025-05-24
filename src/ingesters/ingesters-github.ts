/**
 * GitHub API ingester using REST API
 * Fetches commits, pull requests, issues, and repository events
 */

import axios from 'axios';
import { DateTime } from 'luxon';
import { TimelineEvent, GitHubConfig, EventCategory, MediaAttachment } from '../types/types';

interface GitHubCommitFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
  merged_at?: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: { name: string; color: string }[];
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
  closed_at?: string;
  comments: number;
  labels: { name: string; color: string }[];
}

interface GitHubRepository {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
}

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
      
      // Get user's repositories and activity
      const repoEvents = await this.getRepositoryEvents(username, dateRange);
      events.push(...repoEvents);

      // Get pull requests and reviews if enabled
      if (this.config.includeRepoDetails) {
        const prEvents = await this.getPullRequestEvents(username, dateRange);
        events.push(...prEvents);
      }

      // Get issue activity if enabled
      if (this.config.includeRepoDetails) {
        const issueEvents = await this.getIssueEvents(username, dateRange);
        events.push(...issueEvents);
      }

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
            
            // Get commit details including files if enabled
            let files: GitHubCommitFile[] = [];
            let codeSnippets: MediaAttachment[] = [];
            
            if (this.config.includeCodeSnippets) {
              const commitDetail = await this.apiClient.get(`/repos/${repo.full_name}/commits/${commit.sha}`);
              files = commitDetail.data.files || [];
              
              // Extract interesting code snippets
              codeSnippets = files
                .filter(file => file.patch && file.changes < 300) // Skip large diffs
                .map(file => ({
                  type: 'document',
                  url: `${repo.html_url}/blob/${commit.sha}/${file.filename}`,
                  description: `Changes to ${file.filename}`,
                  metadata: {
                    filename: file.filename,
                    additions: file.additions,
                    deletions: file.deletions,
                    patch: file.patch
                  }
                }));
            }
            
            events.push({
              id: `github-commit-${commit.sha}`,
              platform: 'github',
              category: 'code_commit',
              timestamp: commitTime,
              originalTimestamp: commit.commit.author.date,
              title: `Commit to ${repo.name}`,
              content: commit.commit.message,
              url: commit.html_url,
              username,
              media: codeSnippets,
              metadata: {
                sha: commit.sha,
                repository: repo.full_name,
                repositoryUrl: repo.html_url,
                additions: commit.stats?.additions,
                deletions: commit.stats?.deletions,
                filesChanged: files.length,
                files: files.map(f => ({
                  name: f.filename,
                  status: f.status,
                  additions: f.additions,
                  deletions: f.deletions
                }))
              }
            });
          }

          // Add repository details if enabled
          if (this.config.includeRepoDetails) {
            const repoTime = DateTime.fromISO(repo.created_at);
            if (!dateRange || (repoTime >= dateRange.start && repoTime <= dateRange.end)) {
              events.push({
                id: `github-repo-${repo.id}`,
                platform: 'github',
                category: 'code_create',
                timestamp: repoTime,
                originalTimestamp: repo.created_at,
                title: `Created repository: ${repo.name}`,
                content: repo.description || '',
                url: repo.html_url,
                username,
                metadata: {
                  repository: repo.full_name,
                  language: repo.language,
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  openIssues: repo.open_issues_count,
                  topics: repo.topics,
                  isPrivate: repo.private,
                  hasWiki: repo.has_wiki,
                  hasPages: repo.has_pages
                }
              });
            }
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
   * Get pull request activity
   */
  private async getPullRequestEvents(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Search for PRs created by user
      const searchResponse = await this.apiClient.get('/search/issues', {
        params: {
          q: `type:pr author:${username}`,
          sort: 'updated',
          order: 'desc',
          per_page: 50
        }
      });

      for (const pr of searchResponse.data.items) {
        const prTime = DateTime.fromISO(pr.created_at);
        if (dateRange && (prTime < dateRange.start || prTime > dateRange.end)) {
          continue;
        }

        // Get PR details
        const prDetail = await this.apiClient.get(pr.pull_request.url);
        const pullRequest: GitHubPullRequest = prDetail.data;

        events.push({
          id: `github-pr-${pr.number}`,
          platform: 'github',
          category: 'code_pr',
          timestamp: prTime,
          originalTimestamp: pr.created_at,
          title: `Created pull request: ${pr.title}`,
          content: pr.body || '',
          url: pr.html_url,
          username,
          metadata: {
            number: pr.number,
            state: pr.state,
            comments: pullRequest.comments,
            reviewComments: pullRequest.review_comments,
            commits: pullRequest.commits,
            additions: pullRequest.additions,
            deletions: pullRequest.deletions,
            changedFiles: pullRequest.changed_files,
            labels: pullRequest.labels,
            mergedAt: pullRequest.merged_at
          }
        });

        // Get PR reviews if available
        const reviewsResponse = await this.apiClient.get(`${pr.pull_request.url}/reviews`);
        for (const review of reviewsResponse.data) {
          const reviewTime = DateTime.fromISO(review.submitted_at);
          
          events.push({
            id: `github-pr-review-${review.id}`,
            platform: 'github',
            category: 'comment',
            timestamp: reviewTime,
            originalTimestamp: review.submitted_at,
            title: `Reviewed pull request #${pr.number}`,
            content: review.body || '',
            url: review.html_url,
            username: review.user.login,
            metadata: {
              prNumber: pr.number,
              state: review.state,
              commitId: review.commit_id
            }
          });
        }
      }
    } catch (error) {
      console.error(`Failed to get pull request events: ${error}`);
    }

    return events;
  }

  /**
   * Get issue activity
   */
  private async getIssueEvents(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Search for issues created by user
      const searchResponse = await this.apiClient.get('/search/issues', {
        params: {
          q: `type:issue author:${username}`,
          sort: 'updated',
          order: 'desc',
          per_page: 50
        }
      });

      for (const issue of searchResponse.data.items) {
        const issueTime = DateTime.fromISO(issue.created_at);
        if (dateRange && (issueTime < dateRange.start || issueTime > dateRange.end)) {
          continue;
        }

        events.push({
          id: `github-issue-${issue.number}`,
          platform: 'github',
          category: 'post',
          timestamp: issueTime,
          originalTimestamp: issue.created_at,
          title: `Created issue: ${issue.title}`,
          content: issue.body || '',
          url: issue.html_url,
          username,
          metadata: {
            number: issue.number,
            state: issue.state,
            comments: issue.comments,
            labels: issue.labels,
            closedAt: issue.closed_at
          }
        });

        // Get issue comments
        const commentsResponse = await this.apiClient.get(issue.comments_url);
        for (const comment of commentsResponse.data) {
          const commentTime = DateTime.fromISO(comment.created_at);
          
          events.push({
            id: `github-issue-comment-${comment.id}`,
            platform: 'github',
            category: 'comment',
            timestamp: commentTime,
            originalTimestamp: comment.created_at,
            title: `Commented on issue #${issue.number}`,
            content: comment.body,
            url: comment.html_url,
            username: comment.user.login,
            metadata: {
              issueNumber: issue.number,
              isEdited: comment.updated_at !== comment.created_at
            }
          });
        }
      }
    } catch (error) {
      console.error(`Failed to get issue events: ${error}`);
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
    let metadata: Record<string, any> = {};

    switch (event.type) {
      case 'CreateEvent':
        category = 'code_create';
        title = `Created ${event.payload.ref_type}: ${event.payload.ref || event.repo.name}`;
        content = `Created a new ${event.payload.ref_type} in ${event.repo.name}`;
        metadata = {
          refType: event.payload.ref_type,
          ref: event.payload.ref,
          repository: event.repo.name
        };
        break;
        
      case 'PushEvent':
        category = 'code_push';
        title = `Pushed to ${event.repo.name}`;
        content = `Pushed ${event.payload.commits?.length || 0} commits to ${event.payload.ref}`;
        metadata = {
          repository: event.repo.name,
          ref: event.payload.ref,
          commitCount: event.payload.commits?.length || 0,
          commits: event.payload.commits?.map((c: any) => ({
            sha: c.sha,
            message: c.message
          }))
        };
        break;
        
      case 'PullRequestEvent':
        category = 'code_pr';
        title = `${event.payload.action} pull request in ${event.repo.name}`;
        content = event.payload.pull_request?.title || '';
        metadata = {
          action: event.payload.action,
          number: event.payload.pull_request?.number,
          repository: event.repo.name,
          labels: event.payload.pull_request?.labels,
          additions: event.payload.pull_request?.additions,
          deletions: event.payload.pull_request?.deletions,
          changedFiles: event.payload.pull_request?.changed_files
        };
        break;
        
      case 'IssuesEvent':
        category = 'post';
        title = `${event.payload.action} issue in ${event.repo.name}`;
        content = event.payload.issue?.title || '';
        metadata = {
          action: event.payload.action,
          number: event.payload.issue?.number,
          repository: event.repo.name,
          labels: event.payload.issue?.labels,
          state: event.payload.issue?.state
        };
        break;
        
      case 'ForkEvent':
        category = 'code_create';
        title = `Forked ${event.repo.name}`;
        content = `Created a fork of ${event.repo.name}`;
        metadata = {
          sourceRepository: event.repo.name,
          forkedRepository: event.payload.forkee?.full_name,
          stars: event.payload.forkee?.stargazers_count,
          forks: event.payload.forkee?.forks_count
        };
        break;

      case 'WatchEvent':
        category = 'reaction';
        title = `Starred ${event.repo.name}`;
        content = `Added ${event.repo.name} to starred repositories`;
        metadata = {
          repository: event.repo.name,
          action: event.payload.action
        };
        break;

      case 'PublicEvent':
        category = 'code_create';
        title = `Made ${event.repo.name} public`;
        content = `Repository ${event.repo.name} is now public`;
        metadata = {
          repository: event.repo.name
        };
        break;

      case 'MemberEvent':
        category = 'other';
        title = `${event.payload.action} collaborator to ${event.repo.name}`;
        content = `${event.payload.action} ${event.payload.member?.login} as a collaborator to ${event.repo.name}`;
        metadata = {
          repository: event.repo.name,
          action: event.payload.action,
          member: event.payload.member?.login
        };
        break;

      default:
        return null;
    }

    return {
      id: `github-event-${event.id}`,
      platform: 'github',
      category,
      timestamp: eventTime,
      originalTimestamp: event.created_at,
      title,
      content,
      url: event.repo ? `https://github.com/${event.repo.name}` : '',
      username,
      metadata
    };
  }
}