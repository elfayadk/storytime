/**
 * Markdown exporter for timeline events
 * Generates clean Markdown files with date headers and clickable links
 */

import { TimelineEvent, TimelineConfig } from '../types/types.js';
import { DateTime } from 'luxon';

export class MarkdownExporter {
  /**
   * Export timeline events to Markdown format
   */
  async export(events: TimelineEvent[], config: TimelineConfig): Promise<string> {
    const sortedEvents = this.sortEvents(events);
    const dateRange = this.calculateDateRange(events);
    const platformStats = this.calculatePlatformStats(events);
    
    return `# Activity Timeline

## Overview
- **Date Range**: ${dateRange}
- **Total Events**: ${events.length}
- **Platforms**: ${Object.keys(platformStats).length}

## Platform Statistics
${this.renderPlatformStats(platformStats)}

## Timeline
${this.renderEvents(sortedEvents)}
`;
  }

  /**
   * Sort events by timestamp
   */
  private sortEvents(events: TimelineEvent[]): TimelineEvent[] {
    return [...events].sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    );
  }

  /**
   * Calculate date range string
   */
  private calculateDateRange(events: TimelineEvent[]): string {
    if (!events.length) return 'No events';

    const dates = events.map(e => e.timestamp);
    const startDate = DateTime.min(...dates);
    const endDate = DateTime.max(...dates);

    if (!startDate || !endDate) return 'Invalid dates';

    return `${startDate.toFormat('MMM d, yyyy')} - ${endDate.toFormat('MMM d, yyyy')}`;
  }

  /**
   * Calculate platform statistics
   */
  private calculatePlatformStats(events: TimelineEvent[]): Record<string, number> {
    return events.reduce((stats, event) => {
      stats[event.platform] = (stats[event.platform] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  }

  /**
   * Render platform statistics
   */
  private renderPlatformStats(stats: Record<string, number>): string {
    return Object.entries(stats)
      .map(([platform, count]) => `- **${platform}**: ${count} events`)
      .join('\n');
  }

  /**
   * Render timeline events
   */
  private renderEvents(events: TimelineEvent[]): string {
    return events.map(event => `
### ${event.timestamp.toFormat('MMM d, yyyy HH:mm')} - ${event.title}
- **Platform**: ${event.platform}
- **User**: @${event.username}
- **Content**: ${this.formatContent(event.content)}
- **Link**: [View Original](${event.url})
${this.renderMetadata(event.metadata)}
`).join('\n');
  }

  /**
   * Format event content
   */
  private formatContent(content: string): string {
    // Escape markdown special characters
    return content
      .replace(/[*_`#]/g, '\\$&')
      .replace(/\n/g, '\n  '); // Indent newlines for better readability
  }

  /**
   * Render event metadata
   */
  private renderMetadata(metadata: any): string {
    if (!metadata) return '';

    const lines: string[] = [];

    // Platform-specific metadata
    if (metadata.score !== undefined) {
      lines.push(`- **Score**: ${metadata.score}`);
    }
    if (metadata.numComments !== undefined) {
      lines.push(`- **Comments**: ${metadata.numComments}`);
    }
    if (metadata.repository) {
      lines.push(`- **Repository**: ${metadata.repository}`);
    }

    // NLP metadata
    if (metadata.nlp) {
      const nlp = metadata.nlp;
      if (nlp.sentiment) {
        lines.push(`- **Sentiment**: ${nlp.sentiment.label} (${nlp.sentiment.score.toFixed(2)})`);
      }
      if (nlp.topics?.length) {
        lines.push(`- **Topics**: ${nlp.topics.join(', ')}`);
      }
      if (nlp.entities) {
        const entities = nlp.entities;
        if (entities.people?.length) {
          lines.push(`- **People**: ${entities.people.join(', ')}`);
        }
        if (entities.organizations?.length) {
          lines.push(`- **Organizations**: ${entities.organizations.join(', ')}`);
        }
        if (entities.places?.length) {
          lines.push(`- **Places**: ${entities.places.join(', ')}`);
        }
      }
    }

    return lines.length ? '\n' + lines.join('\n') : '';
  }
}