#!/usr/bin/env node

/**
 * Cross-Platform Activity Timeline Builder
 * CLI entry point with argument parsing
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { DateTime } from 'luxon';
import { TimelineConfig, Platform, PlatformConfigs } from './types.js';
import { TimelineProcessor } from './timeline-processor.js';
import { TwitterIngester } from './ingesters/twitter.js';
import { RedditIngester } from './ingesters/reddit.js';
import { GitHubIngester } from './ingesters/github.js';
import { RSSIngester } from './ingesters/rss.js';
import { PastebinIngester } from './ingesters/pastebin.js';
import { MarkdownExporter } from './exporters/markdown.js';
import { HTMLExporter } from './exporters/html.js';

const program = new Command();

// CLI Configuration
program
  .name('timeline-builder')
  .description('Build unified activity timelines from multiple social platforms')
  .version('1.0.0');

program
  .command('build')
  .description('Build a timeline for a given target')
  .requiredOption('-t, --target <target>', 'Username, email, or hashtag to track')
  .option('-z, --timezone <timezone>', 'Target timezone for normalization', 'UTC')
  .option('-p, --platforms <platforms>', 'Comma-separated list of platforms', 'twitter,reddit,github,rss')
  .option('-s, --start <date>', 'Start date (ISO format)')
  .option('-e, --end <date>', 'End date (ISO format)')
  .option('-o, --output <directory>', 'Output directory', './timeline-output')
  .option('--markdown', 'Generate Markdown export', true)
  .option('--html', 'Generate HTML export', true)
  .option('--twitter-token <token>', 'Twitter Bearer Token')
  .option('--github-token <token>', 'GitHub Personal Access Token')
  .option('--reddit-client-id <id>', 'Reddit Client ID')
  .option('--reddit-client-secret <secret>', 'Reddit Client Secret')
  .option('--pastebin-api-key <key>', 'Pastebin API Key')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('🚀 Cross-Platform Timeline Builder'));
      console.log(chalk.gray('=====================================\n'));

      // Parse platforms
      const platforms = options.platforms.split(',').map((p: string) => p.trim()) as Platform[];
      
      // Parse date range
      const dateRange = options.start && options.end ? {
        start: DateTime.fromISO(options.start),
        end: DateTime.fromISO(options.end)
      } : undefined;

      // Build configuration
      const config: TimelineConfig = {
        target: options.target,
        timezone: options.timezone,
        dateRange,
        platforms,
        output: {
          markdown: options.markdown,
          html: options.html,
          outputDir: options.output
        }
      };

      // Platform credentials
      const platformConfigs: PlatformConfigs = {
        twitter: {
          bearerToken: options.twitterToken || process.env.TWITTER_BEARER_TOKEN
        },
        github: {
          token: options.githubToken || process.env.GITHUB_TOKEN
        },
        reddit: {
          clientId: options.redditClientId || process.env.REDDIT_CLIENT_ID,
          clientSecret: options.redditClientSecret || process.env.REDDIT_CLIENT_SECRET,
          userAgent: 'timeline-builder/1.0.0'
        },
        pastebin: {
          apiKey: options.pastebinApiKey || process.env.PASTEBIN_API_KEY
        }
      };

      console.log(chalk.blue(`📋 Target: ${config.target}`));
      console.log(chalk.blue(`🌍 Timezone: ${config.timezone}`));
      console.log(chalk.blue(`📱 Platforms: ${platforms.join(', ')}`));
      if (dateRange) {
        console.log(chalk.blue(`📅 Date Range: ${dateRange.start.toISODate()} to ${dateRange.end.toISODate()}`));
      }
      console.log();

      // Initialize timeline processor
      const processor = new TimelineProcessor(config, platformConfigs);
      
      // Process timeline
      const spinner = ora('Building timeline...').start();
      const timeline = await processor.buildTimeline();
      spinner.succeed(`Built timeline with ${timeline.length} events`);

      // Export results
      if (config.output.markdown) {
        const markdownExporter = new MarkdownExporter();
        const markdownPath = await markdownExporter.export(timeline, config);
        console.log(chalk.green(`✅ Markdown exported to: ${markdownPath}`));
      }

      if (config.output.html) {
        const htmlExporter = new HTMLExporter();
        const htmlPath = await htmlExporter.export(timeline, config);
        console.log(chalk.green(`✅ HTML timeline exported to: ${htmlPath}`));
      }

      console.log(chalk.cyan('\n🎉 Timeline building complete!'));

    } catch (error) {
      console.error(chalk.red('❌ Error building timeline:'), error);
      process.exit(1);
    }
  });

program
  .command('test-auth')
  .description('Test authentication with various platforms')
  .option('--twitter-token <token>', 'Twitter Bearer Token')
  .option('--github-token <token>', 'GitHub Personal Access Token')
  .option('--reddit-client-id <id>', 'Reddit Client ID')
  .option('--reddit-client-secret <secret>', 'Reddit Client Secret')
  .action(async (options) => {
    console.log(chalk.cyan('🔐 Testing Platform Authentication'));
    console.log(chalk.gray('===================================\n'));

    const configs: PlatformConfigs = {
      twitter: { bearerToken: options.twitterToken || process.env.TWITTER_BEARER_TOKEN },
      github: { token: options.githubToken || process.env.GITHUB_TOKEN },
      reddit: { 
        clientId: options.redditClientId || process.env.REDDIT_CLIENT_ID,
        clientSecret: options.redditClientSecret || process.env.REDDIT_CLIENT_SECRET,
        userAgent: 'timeline-builder/1.0.0'
      }
    };

    // Test Twitter
    if (configs.twitter?.bearerToken) {
      try {
        const twitter = new TwitterIngester(configs.twitter);
        await twitter.testConnection();
        console.log(chalk.green('✅ Twitter: Authentication successful'));
      } catch (error) {
        console.log(chalk.red('❌ Twitter: Authentication failed'));
      }
    } else {
      console.log(chalk.yellow('⚠️  Twitter: No credentials provided'));
    }

    // Test GitHub
    if (configs.github?.token) {
      try {
        const github = new GitHubIngester(configs.github);
        await github.testConnection();
        console.log(chalk.green('✅ GitHub: Authentication successful'));
      } catch (error) {
        console.log(chalk.red('❌ GitHub: Authentication failed'));
      }
    } else {
      console.log(chalk.yellow('⚠️  GitHub: No credentials provided'));
    }

    // Test Reddit
    if (configs.reddit?.clientId && configs.reddit?.clientSecret) {
      try {
        const reddit = new RedditIngester(configs.reddit);
        await reddit.testConnection();
        console.log(chalk.green('✅ Reddit: Authentication successful'));
      } catch (error) {
        console.log(chalk.red('❌ Reddit: Authentication failed'));
      }
    } else {
      console.log(chalk.yellow('⚠️  Reddit: No credentials provided'));
    }
  });

// Parse command line arguments
program.parse();