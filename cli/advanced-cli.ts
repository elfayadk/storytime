#!/usr/bin/env node

/**
 * Advanced Cross-Platform Activity Timeline Builder CLI
 * Enhanced command-line interface with support for all advanced features
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { DateTime } from 'luxon';
import { 
  TimelineConfig, 
  Platform, 
  PlatformConfigs, 
  NLPConfig,
  NetworkConfig,
  VisualizationConfig,
  DashboardConfig,
  ExportConfig
} from '../types.js';
import { AdvancedTimelineBuilder } from '../integration/advanced-timeline-builder.js';

// Define supported platforms
const SUPPORTED_PLATFORMS = [
  'twitter', 'reddit', 'github', 'rss', 'pastebin'
];

// Define supported themes
const SUPPORTED_THEMES = [
  'default', 'dark', 'light', 'minimal', 'colorful'
];

// Initialize command line interface
const program = new Command();

// CLI Configuration
program
  .name('advanced-timeline')
  .description('Advanced Cross-Platform Activity Timeline Builder')
  .version('2.0.0');

// Main build command
program
  .command('build')
  .description('Build an advanced timeline with enhanced features')
  .requiredOption('-t, --target <target>', 'Username, email, or hashtag to track')
  .option('-z, --timezone <timezone>', 'Target timezone for normalization', 'UTC')
  .option('-p, --platforms <platforms>', 'Comma-separated list of platforms', 'twitter,reddit,github,rss')
  .option('-s, --start <date>', 'Start date (ISO format)')
  .option('-e, --end <date>', 'End date (ISO format)')
  .option('-o, --output <directory>', 'Output directory', './timeline-output')
  
  // Platform credentials
  .option('--twitter-token <token>', 'Twitter Bearer Token')
  .option('--twitter-api-key <key>', 'Twitter API Key')
  .option('--twitter-api-secret <secret>', 'Twitter API Secret')
  .option('--twitter-access-token <token>', 'Twitter Access Token')
  .option('--twitter-access-secret <secret>', 'Twitter Access Token Secret')
  .option('--twitter-advanced', 'Enable advanced Twitter features (user network, reply chains)')
  
  .option('--github-token <token>', 'GitHub Personal Access Token')
  .option('--github-include-repos', 'Include repository details')
  .option('--github-include-code', 'Include code snippets')
  
  .option('--reddit-client-id <id>', 'Reddit Client ID')
  .option('--reddit-client-secret <secret>', 'Reddit Client Secret')
  .option('--reddit-username <username>', 'Reddit Username')
  .option('--reddit-password <password>', 'Reddit Password')
  .option('--reddit-include-comments', 'Include comment threads')
  .option('--reddit-comment-depth <depth>', 'Maximum depth for comment threads', '3')
  
  .option('--pastebin-api-key <key>', 'Pastebin API Key')
  .option('--pastebin-username <username>', 'Pastebin Username')
  .option('--pastebin-include-content', 'Include paste content')
  
  .option('--rss-auto-discover', 'Auto-discover related RSS feeds')
  .option('--rss-extract-full', 'Extract full content from RSS feeds')
  .option('--rss-feeds <feeds>', 'Comma-separated list of RSS feed URLs')
  
  // Analysis options
  .option('--analyze-sentiment', 'Enable sentiment analysis', false)
  .option('--analyze-entities', 'Enable entity extraction', false)
  .option('--analyze-topics', 'Enable topic modeling', false)
  .option('--analyze-geo', 'Enable geographic analysis', false)
  .option('--analyze-network', 'Enable network analysis', false)
  
  // Visualization options
  .option('--theme <theme>', 'Visualization theme', 'default')
  .option('--interactive', 'Enable interactive features', false)
  .option('--dashboard', 'Generate interactive dashboard', false)
  .option('--custom-css <url>', 'URL to custom CSS for visualization')
  
  // Export options
  .option('--export-markdown', 'Export to Markdown', true)
  .option('--export-html', 'Export to HTML', true)
  .option('--export-json', 'Export to JSON', false)
  .option('--export-csv', 'Export to CSV', false)
  .option('--export-xml', 'Export to XML', false)
  .option('--split-by-date', 'Split exports by date range', false)
  
  .action(async (options) => {
    try {
      console.log(chalk.cyan('🚀 Advanced Cross-Platform Timeline Builder v2.0'));
      console.log(chalk.gray('=============================================\n'));
      
      // Validate options
      validateOptions(options);
      
      // Parse platforms
      const platforms = options.platforms.split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => SUPPORTED_PLATFORMS.includes(p)) as Platform[];
      
      if (platforms.length === 0) {
        console.error(chalk.red('❌ Error: No valid platforms specified'));
        process.exit(1);
      }
      
      // Parse date range
      const dateRange = options.start && options.end ? {
        start: DateTime.fromISO(options.start),
        end: DateTime.fromISO(options.end)
      } : undefined;
      
      // Build timeline configuration
      const config: TimelineConfig = {
        target: options.target,
        timezone: options.timezone,
        dateRange,
        platforms,
        output: {
          markdown: options.exportMarkdown,
          html: options.exportHtml,
          json: options.exportJson,
          csv: options.exportCsv,
          outputDir: options.output
        },
        analysis: {
          sentiment: options.analyzeSentiment,
          entities: options.analyzeEntities,
          topics: options.analyzeTopics,
          geotagging: options.analyzeGeo,
          network: options.analyzeNetwork
        },
        visualization: {
          theme: options.theme as any,
          customCss: options.customCss,
          interactive: options.interactive ? {
            filtering: true,
            search: true,
            clustering: false,
            map: options.analyzeGeo
          } : undefined
        },
        dashboard: options.dashboard ? {
          enabled: true,
          title: `Timeline for ${options.target}`,
          charts: {
            activityHeatmap: true,
            platformDistribution: true,
            sentimentTrends: options.analyzeSentiment,
            topicDistribution: options.analyzeTopics,
            entityNetwork: options.analyzeEntities && options.analyzeNetwork
          }
        } : undefined
      };
      
      // Platform configurations
      const platformConfigs: PlatformConfigs = {};
      
      // Twitter configuration
      if (platforms.includes('twitter')) {
        platformConfigs.twitter = {
          bearerToken: options.twitterToken || process.env.TWITTER_BEARER_TOKEN,
          apiKey: options.twitterApiKey || process.env.TWITTER_API_KEY,
          apiSecret: options.twitterApiSecret || process.env.TWITTER_API_SECRET,
          accessToken: options.twitterAccessToken || process.env.TWITTER_ACCESS_TOKEN,
          accessTokenSecret: options.twitterAccessSecret || process.env.TWITTER_ACCESS_SECRET,
          advancedFeatures: options.twitterAdvanced
        };
      }
      
      // GitHub configuration
      if (platforms.includes('github')) {
        platformConfigs.github = {
          token: options.githubToken || process.env.GITHUB_TOKEN,
          username: options.target, // Default to target
          includeRepoDetails: options.githubIncludeRepos,
          includeCodeSnippets: options.githubIncludeCode
        };
      }
      
      // Reddit configuration
      if (platforms.includes('reddit')) {
        platformConfigs.reddit = {
          clientId: options.redditClientId || process.env.REDDIT_CLIENT_ID,
          clientSecret: options.redditClientSecret || process.env.REDDIT_CLIENT_SECRET,
          username: options.redditUsername || process.env.REDDIT_USERNAME,
          password: options.redditPassword || process.env.REDDIT_PASSWORD,
          userAgent: 'advanced-timeline-builder/2.0.0',
          includeComments: options.redditIncludeComments,
          maxCommentDepth: options.redditIncludeComments ? 
            parseInt(options.redditCommentDepth, 10) : 0
        };
      }
      
      // Pastebin configuration
      if (platforms.includes('pastebin')) {
        platformConfigs.pastebin = {
          apiKey: options.pastebinApiKey || process.env.PASTEBIN_API_KEY,
          username: options.pastebinUsername || options.target,
          includePasteContent: options.pastebinIncludeContent
        };
      }
      
      // RSS configuration
      if (platforms.includes('rss')) {
        platformConfigs.rss = {
          feedUrls: options.rssFeeds ? options.rssFeeds.split(',').map((f: string) => f.trim()) : undefined,
          autoDiscover: options.rssAutoDiscover,
          extractFullContent: options.rssExtractFull
        };
      }
      
      // Configure analysis options
      const nlpConfig: NLPConfig = {
        languageDetection: { 
          enabled: true 
        },
        entityExtraction: { 
          enabled: !!options.analyzeEntities,
          minConfidence: 0.6
        },
        sentimentAnalysis: { 
          enabled: !!options.analyzeSentiment,
          model: 'basic'
        },
        topicModeling: { 
          enabled: !!options.analyzeTopics,
          numTopics: 5
        }
      };
      
      // Configure network options
      const networkConfig: NetworkConfig = {
        enabled: !!options.analyzeNetwork,
        relationTypes: ['mention', 'reply', 'quote', 'cooccurrence'],
        minEdgeWeight: 1
      };
      
      // Configure visualization options
      const visualConfig: VisualizationConfig = {
        theme: (SUPPORTED_THEMES.includes(options.theme) 
          ? options.theme 
          : 'default') as any,
        customCss: options.customCss,
        interactive: {
          filtering: options.interactive,
          search: options.interactive,
          clustering: false,
          map: options.analyzeGeo
        }
      };
      
      // Configure dashboard options
      const dashboardConfig: DashboardConfig = {
        enabled: !!options.dashboard,
        title: `Timeline Dashboard for ${options.target}`,
        refreshInterval: 0,
        charts: {
          activityHeatmap: true,
          platformDistribution: true,
          sentimentTrends: options.analyzeSentiment,
          topicDistribution: options.analyzeTopics,
          entityNetwork: options.analyzeEntities && options.analyzeNetwork
        }
      };
      
      // Configure export options
      const exportConfig: ExportConfig = {
        formats: {
          markdown: options.exportMarkdown,
          html: options.exportHtml,
          json: options.exportJson,
          csv: options.exportCsv
        },
        outputDir: options.output,
        splitByDate: options.splitByDate
      };
      
      // Display configuration summary
      console.log(chalk.blue(`📋 Target: ${config.target}`));
      console.log(chalk.blue(`🌍 Timezone: ${config.timezone}`));
      console.log(chalk.blue(`📱 Platforms: ${platforms.join(', ')}`));
      if (dateRange) {
        console.log(chalk.blue(`📅 Date Range: ${dateRange.start.toISODate()} to ${dateRange.end.toISODate()}`));
      }
      
      // Show analysis options
      if (options.analyzeSentiment || options.analyzeEntities || 
          options.analyzeTopics || options.analyzeGeo || options.analyzeNetwork) {
        console.log(chalk.blue('🧠 Analysis:'));
        if (options.analyzeSentiment) console.log(chalk.gray('  • Sentiment Analysis'));
        if (options.analyzeEntities) console.log(chalk.gray('  • Entity Extraction'));
        if (options.analyzeTopics) console.log(chalk.gray('  • Topic Modeling'));
        if (options.analyzeGeo) console.log(chalk.gray('  • Geographic Analysis'));
        if (options.analyzeNetwork) console.log(chalk.gray('  • Network Analysis'));
      }
      
      // Show export options
      console.log(chalk.blue('💾 Exports:'));
      if (options.exportMarkdown) console.log(chalk.gray('  • Markdown'));
      if (options.exportHtml) console.log(chalk.gray('  • HTML'));
      if (options.exportJson) console.log(chalk.gray('  • JSON'));
      if (options.exportCsv) console.log(chalk.gray('  • CSV'));
      if (options.exportXml) console.log(chalk.gray('  • XML'));
      console.log();
      
      // Initialize advanced timeline builder
      const builder = new AdvancedTimelineBuilder(
        config,
        platformConfigs,
        {
          nlpConfig,
          networkConfig,
          geoConfig: { enabled: !!options.analyzeGeo },
          visualConfig,
          dashboardConfig,
          exportConfig
        }
      );
      
      // Build the advanced timeline
      const result = await builder.buildAdvancedTimeline();
      
      console.log(chalk.green(`\n✅ Timeline generated with ${result.events.length} events`));
      console.log(chalk.green(`📁 Output files created: ${result.outputFiles.length}`));
      
      console.log(chalk.cyan('\n🎉 Advanced timeline building complete!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error building timeline:'), error);
      process.exit(1);
    }
  });

// Test authentication command
program
  .command('test-auth')
  .description('Test authentication with various platforms')
  .option('--twitter-token <token>', 'Twitter Bearer Token')
  .option('--twitter-api-key <key>', 'Twitter API Key')
  .option('--twitter-api-secret <secret>', 'Twitter API Secret')
  .option('--github-token <token>', 'GitHub Personal Access Token')
  .option('--reddit-client-id <id>', 'Reddit Client ID')
  .option('--reddit-client-secret <secret>', 'Reddit Client Secret')
  .option('--pastebin-api-key <key>', 'Pastebin API Key')
  .action(async (options) => {
    console.log(chalk.cyan('🔐 Testing Platform Authentication'));
    console.log(chalk.gray('===================================\n'));
    
    // Import necessary ingesters
    const { TwitterIngester } = await import('../ingesters/twitter.js');
    const { GitHubIngester } = await import('../ingesters/github.js');
    const { RedditIngester } = await import('../ingesters/reddit.js');
    const { PastebinIngester } = await import('../ingesters/pastebin.js');
    
    const configs: PlatformConfigs = {
      twitter: { 
        bearerToken: options.twitterToken || process.env.TWITTER_BEARER_TOKEN,
        apiKey: options.twitterApiKey || process.env.TWITTER_API_KEY,
        apiSecret: options.twitterApiSecret || process.env.TWITTER_API_SECRET
      },
      github: { 
        token: options.githubToken || process.env.GITHUB_TOKEN 
      },
      reddit: { 
        clientId: options.redditClientId || process.env.REDDIT_CLIENT_ID,
        clientSecret: options.redditClientSecret || process.env.REDDIT_CLIENT_SECRET,
        userAgent: 'advanced-timeline-builder/2.0.0'
      },
      pastebin: {
        apiKey: options.pastebinApiKey || process.env.PASTEBIN_API_KEY
      }
    };
    
    // Test Twitter
    if (configs.twitter?.bearerToken || (configs.twitter?.apiKey && configs.twitter?.apiSecret)) {
      try {
        const twitter = new TwitterIngester(configs.twitter);
        await twitter.testConnection();
        console.log(chalk.green('✅ Twitter: Authentication successful'));
      } catch (error) {
        console.log(chalk.red('❌ Twitter: Authentication failed'));
        console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
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
        console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
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
        console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else {
      console.log(chalk.yellow('⚠️  Reddit: No credentials provided'));
    }
    
    // Test Pastebin
    if (configs.pastebin?.apiKey) {
      try {
        const pastebin = new PastebinIngester(configs.pastebin);
        await pastebin.testConnection();
        console.log(chalk.green('✅ Pastebin: Authentication successful'));
      } catch (error) {
        console.log(chalk.red('❌ Pastebin: Authentication failed'));
        console.log(chalk.gray(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else {
      console.log(chalk.yellow('⚠️  Pastebin: No credentials provided'));
    }
  });

// Validate CLI options
function validateOptions(options: any) {
  // Validate theme
  if (options.theme && !SUPPORTED_THEMES.includes(options.theme)) {
    console.warn(chalk.yellow(`⚠️  Warning: Unsupported theme '${options.theme}'. Using 'default' instead.`));
    options.theme = 'default';
  }
  
  // Validate platforms
  if (options.platforms) {
    const platforms = options.platforms.split(',').map((p: string) => p.trim());
    const invalidPlatforms = platforms.filter((p: string) => !SUPPORTED_PLATFORMS.includes(p));
    
    if (invalidPlatforms.length > 0) {
      console.warn(chalk.yellow(`⚠️  Warning: Unsupported platforms: ${invalidPlatforms.join(', ')}`));
    }
    
    if (platforms.filter((p: string) => SUPPORTED_PLATFORMS.includes(p)).length === 0) {
      console.error(chalk.red('❌ Error: No valid platforms specified'));
      process.exit(1);
    }
  }
  
  // Validate date range
  if ((options.start && !options.end) || (!options.start && options.end)) {
    console.error(chalk.red('❌ Error: Both start and end dates must be provided'));
    process.exit(1);
  }
  
  if (options.start && options.end) {
    const start = DateTime.fromISO(options.start);
    const end = DateTime.fromISO(options.end);
    
    if (!start.isValid) {
      console.error(chalk.red(`❌ Error: Invalid start date: ${options.start}`));
      process.exit(1);
    }
    
    if (!end.isValid) {
      console.error(chalk.red(`❌ Error: Invalid end date: ${options.end}`));
      process.exit(1);
    }
    
    if (end < start) {
      console.error(chalk.red('❌ Error: End date must be after start date'));
      process.exit(1);
    }
  }
}

// Parse command line arguments
program.parse();

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
}