#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { buildTimeline } from './timeline-builder.js';
import { loadConfig } from './config.js';
import { createLogger } from './util/logger.js';
import { exportTimeline, EXPORT_EXT, type ExportFormat } from './exporters/index.js';
import { PLATFORMS, type Platform } from './types.js';

const program = new Command();

program
  .name('storytime')
  .description('Cross-platform activity timeline builder - 100% free & open-source')
  .version('2.0.0');

program
  .argument('<target>', 'username, @handle, user@instance (mastodon), or #hashtag')
  .option('-p, --platforms <list>', `comma list: ${PLATFORMS.join(',')}`, 'github,mastodon,bluesky,hackernews,devto')
  .option('-l, --limit <n>', 'max events per platform', '50')
  .option('-f, --format <fmt>', 'json|csv|md|xml|html|dossier', 'md')
  .option('-o, --output <file>', 'write to file (default: stdout)')
  .option('--since <iso>', 'only events on/after this ISO date')
  .option('--until <iso>', 'only events on/before this ISO date')
  .option('--rss <urls>', 'comma-separated RSS/Atom feed URLs')
  .option('--pastebin <ids>', 'comma-separated pastebin ids/urls')
  .option('--mastodon-instance <host>', 'default mastodon instance', 'mastodon.social')
  .option('--github-token <token>', 'optional GitHub token (raises rate limit)')
  .option('--ai', 'enable local Ollama enrichment (must be running)', false)
  .option('--no-geo', 'disable Nominatim geocoding')
  .option('-q, --quiet', 'suppress progress logs', false)
  .action(async (target: string, opts) => {
    const platforms = String(opts.platforms)
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is Platform => (PLATFORMS as string[]).includes(s));

    const rssFeeds = opts.rss ? String(opts.rss).split(',').map((s: string) => s.trim()) : [];
    const pastebinIds = opts.pastebin ? String(opts.pastebin).split(',').map((s: string) => s.trim()) : [];
    if (rssFeeds.length && !platforms.includes('rss')) platforms.push('rss');
    if (pastebinIds.length && !platforms.includes('pastebin')) platforms.push('pastebin');

    const logger = createLogger(opts.quiet ? 'error' : 'info');
    const config = loadConfig({
      platforms,
      limitPerPlatform: Number(opts.limit),
      since: opts.since,
      until: opts.until,
      rssFeeds,
      pastebinIds,
      mastodon: { instance: opts.mastodonInstance },
      github: { token: opts.githubToken || process.env.GITHUB_TOKEN },
      ai: { ...loadConfig().ai, enabled: !!opts.ai },
    });

    const spinner = opts.quiet ? null : ora('Building timeline…').start();
    try {
      const result = await buildTimeline(target, {
        config,
        logger,
        enrich: { ai: !!opts.ai, geo: opts.geo !== false },
        onProgress: (p) => {
          if (spinner) spinner.text = p.message;
        },
      });
      if (spinner) spinner.succeed(`${result.events.length} events across ${Object.keys(result.stats.byPlatform).length} platform(s)`);

      const format = String(opts.format) as ExportFormat;
      const out = exportTimeline(result, format);
      if (opts.output) {
        await writeFile(opts.output, out, 'utf8');
        console.error(chalk.green(`Wrote ${opts.output} (${EXPORT_EXT[format]})`));
      } else {
        process.stdout.write(out + '\n');
      }
    } catch (err) {
      if (spinner) spinner.fail((err as Error).message);
      else console.error(chalk.red((err as Error).message));
      process.exitCode = 1;
    }
  });

program.parseAsync();
