/**
 * HTML exporter for timeline events using Timeline.js
 * Generates interactive HTML timeline visualizations
 */

import { TimelineEvent, TimelineConfig } from '../types/types.js';
import { DateTime } from 'luxon';

export class HTMLExporter {
  private events: TimelineEvent[];
  private config: TimelineConfig;

  constructor(events: TimelineEvent[], config: TimelineConfig) {
    this.events = events;
    this.config = config;
  }

  /**
   * Export timeline events to an interactive HTML file
   */
  async export(): Promise<string> {
    const sortedEvents = this.sortEvents();
    const dateRange = this.calculateDateRange(this.events);
    const platformStats = this.calculatePlatformStats();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Activity Timeline</title>
          <style>
            ${this.getStyles()}
          </style>
        </head>
        <body>
          <div class="container">
            <header>
              <h1>Activity Timeline</h1>
              <div class="stats">
                <div class="stat-card">
                  <div class="stat-label">Date Range</div>
                  <div class="stat-value">${dateRange}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Total Events</div>
                  <div class="stat-value">${this.events.length}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Platforms</div>
                  <div class="stat-value">${Object.keys(platformStats).length}</div>
                </div>
              </div>
            </header>
            <main>
              <div class="timeline">
                ${this.renderEvents(sortedEvents)}
              </div>
            </main>
          </div>
          <script>
            ${this.getScript()}
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Sort events by timestamp
   */
  private sortEvents(): TimelineEvent[] {
    return [...this.events].sort((a, b) => 
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
  private calculatePlatformStats(): Record<string, number> {
    return this.events.reduce((stats, event) => {
      stats[event.platform] = (stats[event.platform] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  }

  /**
   * Render timeline events
   */
  private renderEvents(events: TimelineEvent[]): string {
    return events.map(event => `
      <div class="timeline-item ${event.platform}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-date">${event.timestamp.toFormat('MMM d, yyyy HH:mm')}</span>
            <span class="timeline-platform">${event.platform}</span>
          </div>
          <h3 class="timeline-title">${this.escapeHtml(event.title)}</h3>
          <div class="timeline-body">
            ${this.formatContent(event)}
          </div>
          <div class="timeline-footer">
            <a href="${event.url}" target="_blank" rel="noopener noreferrer">View Original</a>
            <span class="timeline-username">@${event.username}</span>
          </div>
        </div>
      </div>
    `).join('\n');
  }

  /**
   * Format event content based on type
   */
  private formatContent(event: TimelineEvent): string {
    let content = this.escapeHtml(event.content);

    // Convert URLs to links
    content = content.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Convert newlines to <br>
    content = content.replace(/\n/g, '<br>');

    return content;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
      /* Reset and base styles */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      /* Header styles */
      header {
        text-align: center;
        margin-bottom: 3rem;
      }

      h1 {
        font-size: 2.5rem;
        margin-bottom: 2rem;
        color: #2c3e50;
      }

      .stats {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        min-width: 200px;
      }

      .stat-label {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 0.5rem;
      }

      .stat-value {
        font-size: 1.2rem;
        font-weight: bold;
        color: #2c3e50;
      }

      /* Timeline styles */
      .timeline {
        position: relative;
        max-width: 800px;
        margin: 0 auto;
      }

      .timeline::before {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        height: 100%;
        background: #e0e0e0;
      }

      .timeline-item {
        position: relative;
        margin-bottom: 2rem;
        width: calc(50% - 2rem);
      }

      .timeline-item:nth-child(odd) {
        margin-left: auto;
      }

      .timeline-dot {
        position: absolute;
        left: -2.5rem;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: #3498db;
        top: 1.5rem;
      }

      .timeline-item:nth-child(odd) .timeline-dot {
        left: auto;
        right: -2.5rem;
      }

      .timeline-content {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .timeline-date {
        font-size: 0.9rem;
        color: #666;
      }

      .timeline-platform {
        font-size: 0.8rem;
        text-transform: uppercase;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        background: #f0f0f0;
      }

      .timeline-title {
        margin-bottom: 1rem;
        color: #2c3e50;
      }

      .timeline-body {
        margin-bottom: 1rem;
      }

      .timeline-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9rem;
      }

      .timeline-footer a {
        color: #3498db;
        text-decoration: none;
      }

      .timeline-footer a:hover {
        text-decoration: underline;
      }

      .timeline-username {
        color: #666;
      }

      /* Platform-specific styles */
      .twitter .timeline-dot { background: #1da1f2; }
      .reddit .timeline-dot { background: #ff4500; }
      .github .timeline-dot { background: #24292e; }
      .rss .timeline-dot { background: #ee802f; }
      .pastebin .timeline-dot { background: #02456c; }

      /* Responsive styles */
      @media (max-width: 768px) {
        .timeline::before {
          left: 1rem;
        }

        .timeline-item {
          width: calc(100% - 3rem);
          margin-left: 3rem !important;
        }

        .timeline-dot {
          left: -2rem !important;
        }

        .stats {
          flex-direction: column;
          align-items: center;
        }

        .stat-card {
          width: 100%;
          max-width: 300px;
        }
      }
    `;
  }

  /**
   * Get JavaScript for interactivity
   */
  private getScript(): string {
    return `
      // Add any interactive features here
      document.addEventListener('DOMContentLoaded', () => {
        // Animate timeline items on scroll
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
              }
            });
          },
          { threshold: 0.1 }
        );

        document.querySelectorAll('.timeline-item').forEach(item => {
          item.style.opacity = '0';
          item.style.transform = 'translateY(20px)';
          item.style.transition = 'all 0.5s ease-out';
          observer.observe(item);
        });
      });
    `;
  }
}