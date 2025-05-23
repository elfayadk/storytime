/**
 * HTML exporter for timeline events using Timeline.js
 * Generates interactive HTML timeline visualizations
 */

import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import { TimelineEvent, TimelineConfig } from './types.js';

export class HTMLExporter {
  /**
   * Export timeline events to an interactive HTML file
   */
  async export(events: TimelineEvent[], config: TimelineConfig): Promise<string> {
    const outputDir = config.output.outputDir || './timeline-output';
    const filename = `timeline-${config.target.replace(/[^a-zA-Z0-9]/g, '_')}-${DateTime.now().toFormat('yyyy-MM-dd')}.html`;
    const filepath = path.join(outputDir, filename);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate Timeline.js data format
    const timelineData = this.generateTimelineData(events, config);
    
    // Generate complete HTML document
    const html = this.generateHTML(timelineData, config);
    
    // Write to file
    await fs.writeFile(filepath, html, 'utf-8');
    
    return filepath;
  }

  /**
   * Convert timeline events to Timeline.js format
   */
  private generateTimelineData(events: TimelineEvent[], config: TimelineConfig) {
    const timelineEvents = events.map(event => ({
      start_date: {
        year: event.timestamp.year,
        month: event.timestamp.month,
        day: event.timestamp.day,
        hour: event.timestamp.hour,
        minute: event.timestamp.minute
      },
      text: {
        headline: this.sanitizeHTML(event.title),
        text: this.formatEventHTML(event)
      },
      media: {
        url: event.url,
        caption: `View on ${this.capitalize(event.platform)}`,
        link: event.url,
        link_target: "_blank"
      },
      group: this.capitalize(event.platform),
      background: {
        color: this.getPlatformColor(event.platform)
      },
      unique_id: event.id
    }));

    return {
      title: {
        text: {
          headline: `Activity Timeline: ${config.target}`,
          text: `<p>Cross-platform activity analysis covering ${config.platforms.join(', ')}</p>
                 <p><strong>Generated:</strong> ${DateTime.now().toFormat('MMMM dd, yyyy \'at\' HH:mm')} (${config.timezone})</p>
                 <p><strong>Total Events:</strong> ${events.length}</p>`
        },
        media: {
          url: "",
          caption: "Cross-Platform Timeline Builder"
        },
        background: {
          color: "#2c3e50"
        }
      },
      events: timelineEvents
    };
  }

  /**
   * Generate complete HTML document with Timeline.js
   */
  private generateHTML(timelineData: any, config: TimelineConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activity Timeline: ${this.sanitizeHTML(config.target)}</title>
    
    <!-- Timeline.js CSS -->
    <link title="timeline-styles" rel="stylesheet" href="https://cdn.knightlab.com/libs/timeline3/latest/css/timeline.css">
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: #f8f9fa;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 1rem;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            margin: 0 0 0.5rem 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        
        .header p {
            margin: 0;
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats-bar {
            background: white;
            padding: 1rem;
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .stat {
            text-align: center;
            padding: 0.5rem 1rem;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #666;
            margin-top: 0.25rem;
        }
        
        .timeline-container {
            height: 70vh;
            min-height: 500px;
            margin: 2rem 1rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 2rem 1rem;
            margin-top: 2rem;
        }
        
        .platform-legend {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin: 1rem 0;
            flex-wrap: wrap;
        }
        
        .platform-badge {
            background: #34495e;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .platform-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .header h1 { font-size: 2rem; }
            .stats-bar { gap: 1rem; }
            .timeline-container { 
                margin: 1rem 0.5rem;
                height: 60vh;
            }
        }
        
        /* Timeline.js customizations */
        .tl-timeline {
            border-radius: 8px !important;
        }
        
        .tl-slide-content {
            background: rgba(255,255,255,0.95) !important;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Activity Timeline</h1>
        <p>Cross-platform digital footprint analysis for <strong>${this.sanitizeHTML(config.target)}</strong></p>
    </div>
    
    <div class="stats-bar">
        <div class="stat">
            <div class="stat-value">${timelineData.events.length}</div>
            <div class="stat-label">Total Events</div>
        </div>
        <div class="stat">
            <div class="stat-value">${config.platforms.length}</div>
            <div class="stat-label">Platforms</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.getDateRange(timelineData.events)}</div>
            <div class="stat-label">Days Covered</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.getMostActiveDay(timelineData.events)}</div>
            <div class="stat-label">Peak Activity</div>
        </div>
    </div>
    
    <div class="platform-legend">
        ${config.platforms.map(platform => `
            <div class="platform-badge">
                <div class="platform-color" style="background: ${this.getPlatformColor(platform)}"></div>
                ${this.getPlatformIcon(platform)} ${this.capitalize(platform)}
            </div>
        `).join('')}
    </div>
    
    <div class="timeline-container">
        <div id="timeline-embed" style="width: 100%; height: 100%;"></div>
    </div>
    
    <div class="footer">
        <p><strong>Generated by Cross-Platform Activity Timeline Builder</strong></p>
        <p>Data collected from: ${config.platforms.join(', ')}</p>
        <p>Timezone: ${config.timezone} • Generated: ${DateTime.now().toFormat('MMM dd, yyyy HH:mm')}</p>
    </div>

    <!-- Timeline.js JavaScript -->
    <script src="https://cdn.knightlab.com/libs/timeline3/latest/js/timeline.js"></script>
    
    <script>
        // Timeline data
        const timelineData = ${JSON.stringify(timelineData, null, 2)};
        
        // Timeline options
        const options = {
            font: "default",
            lang: "en",
            initial_zoom: 2,
            zoom_sequence: [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
            timenav_height: 200,
            timenav_height_percentage: 25,
            timenav_mobile_height_percentage: 40,
            timenav_height_min: 150,
            start_at_slide: 0,
            menubar_height: 0,
            use_bc: false,
            duration: 1000,
            ease: TL.Ease.easeInOutQuint,
            dragging: true,
            trackResize: true,
            slide_padding_lr: 100,
            slide_default_fade: "0%",
            marker_padding: 5,
            marker_height_min: 30,
            marker_width_min: 100,
            marker_content_y: "50%",
            hash_bookmark: false,
            debug: false
        };
        
        // Initialize timeline
        window.timeline = new TL.Timeline('timeline-embed', timelineData, options);
        
        // Add loading indicator
        document.addEventListener('DOMContentLoaded', function() {
            const container = document.getElementById('timeline-embed');
            container.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; font-size: 1.2rem; color: #666;"><div>📊 Loading interactive timeline...</div></div>';
        });
        
        // Handle responsive resizing
        window.addEventListener('resize', function() {
            if (window.timeline) {
                window.timeline.updateDisplay();
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Format event content as HTML
   */
  private formatEventHTML(event: TimelineEvent): string {
    const parts: string[] = [];
    
    // Main content
    if (event.content) {
      const truncatedContent = event.content.length > 300 
        ? event.content.substring(0, 300) + '...'
        : event.content;
      parts.push(`<p>${this.sanitizeHTML(truncatedContent)}</p>`);
    }
    
    // Metadata
    const metadata: string[] = [];
    
    if (event.username && event.username !== 'unknown') {
      metadata.push(`<strong>User:</strong> @${this.sanitizeHTML(event.username)}`);
    }
    
    if (event.metadata.score !== undefined) {
      metadata.push(`<strong>Score:</strong> ${event.metadata.score}`);
    }
    
    if (event.metadata.numComments !== undefined) {
      metadata.push(`<strong>Comments:</strong> ${event.metadata.numComments}`);
    }
    
    if (event.metadata.repository) {
      metadata.push(`<strong>Repository:</strong> ${this.sanitizeHTML(event.metadata.repository)}`);
    }
    
    if (metadata.length > 0) {
      parts.push(`<div style="margin-top: 1rem; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem;">${metadata.join(' • ')}</div>`);
    }
    
    // Platform and time info
    parts.push(`<div style="margin-top: 1rem; font-size: 0.8rem; color: #666;">
      ${this.getPlatformIcon(event.platform)} ${this.capitalize(event.platform)} • 
      ${event.timestamp.toFormat('HH:mm')} • 
      <a href="${event.url}" target="_blank" style="color: #667eea;">View Original</a>
    </div>`);
    
    return parts.join('');
  }

  /**
   * Get platform-specific colors for visual distinction
   */
  private getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      twitter: '#1DA1F2',
      reddit: '#FF4500',
      github: '#333333',
      rss: '#FF6600',
      pastebin: '#02A8F3'
    };
    return colors[platform] || '#667eea';
  }

  /**
   * Get platform icons/emojis
   */
  private getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      twitter: '🐦',
      reddit: '🤖',
      github: '💻',
      rss: '📰',
      pastebin: '📋'
    };
    return icons[platform] || '📱';
  }

  /**
   * Calculate date range from events
   */
  private getDateRange(events: any[]): string {
    if (events.length === 0) return '0';
    
    const dates = events.map(e => DateTime.fromObject(e.start_date));
    const earliest = DateTime.min(...dates);
    const latest = DateTime.max(...dates);
    
    return Math.ceil(latest.diff(earliest, 'days').days).toString();
  }

  /**
   * Find the most active day
   */
  private getMostActiveDay(events: any[]): string {
    const dateCounts: Record<string, number> = {};
    
    events.forEach(event => {
      const date = DateTime.fromObject(event.start_date);
      const dateKey = date.toISODate();
      if (dateKey) {
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
      }
    });
    
    const maxCount = Math.max(...Object.values(dateCounts));
    return `${maxCount} events`;
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  private sanitizeHTML(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}