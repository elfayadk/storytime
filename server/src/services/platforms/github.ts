import { Octokit } from 'octokit';
import { User, TimelineEvent, EventCategory } from '../../types';
import { logger } from '../../utils/logger';

let octokit: Octokit;

export const initializeGitHubClient = () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GitHub token not found in environment variables');
  }
  octokit = new Octokit({ auth: token });
};

export const scrapeGitHubUser = async (username: string): Promise<{ user: User; events: TimelineEvent[] }> => {
  try {
    // Fetch user profile
    const { data: githubUser } = await octokit.rest.users.getByUsername({ username });

    const user: User = {
      id: githubUser.id.toString(),
      username: githubUser.login,
      name: githubUser.name || githubUser.login,
      email: githubUser.email || '',
      avatarUrl: githubUser.avatar_url,
      bio: githubUser.bio || '',
      location: githubUser.location || '',
      company: githubUser.company || '',
      socialLinks: {
        github: githubUser.html_url,
        twitter: githubUser.twitter_username ? `https://twitter.com/${githubUser.twitter_username}` : undefined
      }
    };

    // Fetch user events
    const { data: githubEvents } = await octokit.rest.activity.listPublicEventsForUser({ username });

    const events: TimelineEvent[] = await Promise.all(
      githubEvents.map(async (event) => {
        let category: EventCategory;
        switch (event.type) {
          case 'PushEvent':
            category = 'code_commit';
            break;
          case 'PullRequestEvent':
            category = 'code_pr';
            break;
          case 'CreateEvent':
            category = 'code_create';
            break;
          case 'IssuesEvent':
            category = 'issue';
            break;
          case 'IssueCommentEvent':
            category = 'comment';
            break;
          default:
            category = 'code_commit';
        }

        let title = '';
        let description = '';
        let content = '';
        let metadata: Record<string, unknown> = {};

        switch (event.type) {
          case 'PushEvent': {
            const payload = event.payload as any;
            title = `Pushed ${payload.commits?.length || 0} commits`;
            description = payload.commits?.[0]?.message || '';
            content = payload.commits?.map((c: any) => c.message).join('\n') || '';
            metadata = {
              commits: payload.commits?.length || 0,
              ref: payload.ref
            };
            break;
          }
          case 'PullRequestEvent': {
            const payload = event.payload as any;
            title = payload.pull_request.title;
            description = `PR #${payload.number} - ${payload.action}`;
            content = payload.pull_request.body || '';
            metadata = {
              number: payload.number,
              action: payload.action,
              additions: payload.pull_request.additions,
              deletions: payload.pull_request.deletions
            };
            break;
          }
          // Add more event type handling as needed
        }

        return {
          id: event.id,
          timestamp: event.created_at,
          title,
          description,
          content,
          category,
          platform: 'github',
          user,
          sentiment: {
            score: 0.5,
            label: 'neutral'
          },
          topics: [],
          metadata
        };
      })
    );

    return { user, events };
  } catch (error) {
    logger.error('Error scraping GitHub user:', error);
    throw error;
  }
}; 