/**
 * Dashboard Generator Module
 * Creates interactive visualizations and dashboards for timeline data
 */

import { DateTime } from 'luxon';
import { TimelineEvent, TimelineStats, Platform, DashboardConfig, VisualizationConfig } from '../types.js';

export class DashboardGenerator {
  private dashboardConfig: DashboardConfig;
  private visualConfig: VisualizationConfig;
  
  constructor(dashboardConfig: DashboardConfig, visualConfig: VisualizationConfig) {
    this.dashboardConfig = dashboardConfig;
    this.visualConfig = visualConfig;
  }
  
  /**
   * Generate an interactive HTML dashboard
   */
  async generateDashboard(events: TimelineEvent[], stats: TimelineStats): Promise<string> {
    if (!this.dashboardConfig.enabled) {
      throw new Error('Dashboard generation is disabled in configuration');
    }
    
    let html = this.generateDashboardHeader();
    
    html += this.generateSummarySection(stats);
    
    // Generate chart sections based on config
    if (this.dashboardConfig.charts.activityHeatmap) {
      html += this.generateActivityHeatmap(events);
    }
    
    if (this.dashboardConfig.charts.platformDistribution) {
      html += this.generatePlatformDistribution(stats);
    }
    
    if (this.dashboardConfig.charts.sentimentTrends && stats.sentiment) {
      html += this.generateSentimentTrends(stats);
    }
    
    if (this.dashboardConfig.charts.topicDistribution && stats.topics) {
      html += this.generateTopicDistribution(stats);
    }
    
    if (this.dashboardConfig.charts.entityNetwork && stats.entities) {
      html += this.generateEntityNetworkChart(stats);
    }
    
    html += this.generateEventListSection(events);
    
    html += this.generateDashboardFooter();
    
    return html;
  }
  
  /**
   * Generate dashboard HTML header with CSS and JS dependencies
   */
  private generateDashboardHeader(): string {
    const title = this.dashboardConfig.title || 'Timeline Dashboard';
    const theme = this.visualConfig.theme || 'default';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- CSS Libraries -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vis-network@9.1.2/dist/dist/vis-network.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
  
  ${this.visualConfig.customCss ? `<link rel="stylesheet" href="${this.visualConfig.customCss}">` : ''}
  
  <style>
    :root {
      ${this.getThemeColors(theme)}
    }
    
    body {
      background-color: var(--bg-color);
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      padding: 20px 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 20px;
    }
    
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .card-header {
      background-color: var(--card-header-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 15px 20px;
      font-weight: 600;
    }
    
    .card-body {
      padding: 20px;
    }
    
    .chart-container {
      position: relative;
      height: 400px;
      width: 100%;
    }
    
    .stats-overview {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      flex: 1;
      min-width: 200px;
      padding: 15px;
      border-radius: 8px;
      background-color: var(--stat-card-bg);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .stat-label {
      font-size: 14px;
      color: var(--muted-text);
    }
    
    .timeline-controls {
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    
    .filter-controls {
      margin-top: 15px;
    }
    
    .platform-icon {
      width: 16px;
      height: 16px;
      margin-right: 5px;
    }
    
    .event-list {
      max-height: 500px;
      overflow-y: auto;
    }
    
    .event-item {
      padding: 10px 15px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: flex-start;
    }
    
    .event-time {
      flex: 0 0 120px;
      font-size: 14px;
      color: var(--muted-text);
    }
    
    .event-platform {
      flex: 0 0 100px;
      font-size: 14px;
    }
    
    .event-content {
      flex: 1;
    }
    
    .event-title {
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .event-description {
      font-size: 14px;
      color: var(--muted-text);
    }
    
    .event-link {
      font-size: 13px;
      color: var(--link-color);
      text-decoration: none;
    }
    
    .event-link:hover {
      text-decoration: underline;
    }
    
    #network-chart {
      height: 500px;
      border: 1px solid var(--border-color);
      background-color: var(--network-bg);
    }
    
    /* Platform colors */
    .twitter-color { color: #1DA1F2; }
    .reddit-color { color: #FF4500; }
    .github-color { color: #2B3137; }
    .rss-color { color: #FFA500; }
    .pastebin-color { color: #02A79C; }
    
    /* Category badges */
    .badge-post { background-color: #007bff; }
    .badge-comment { background-color: #6c757d; }
    .badge-code { background-color: #343a40; }
    .badge-blog { background-color: #28a745; }
    .badge-snippet { background-color: #17a2b8; }
    
    /* Sentiment indicators */
    .sentiment-positive { color: #28a745; }
    .sentiment-negative { color: #dc3545; }
    .sentiment-neutral { color: #6c757d; }
  </style>
</head>
<body>
  <div class="dashboard-container">
    <div class="header">
      <h1>${title}</h1>
      <p class="text-muted">Interactive visualization of your cross-platform digital footprint</p>
    </div>
`;
  }
  
  /**
   * Generate summary statistics section
   */
  private generateSummarySection(stats: TimelineStats): string {
    // Format date range
    const startDate = stats.dateRange.start ? 
      stats.dateRange.start.toFormat('LLL d, yyyy') : 'N/A';
    
    const endDate = stats.dateRange.end ? 
      stats.dateRange.end.toFormat('LLL d, yyyy') : 'N/A';
    
    // Calculate platform percentages
    const platforms = Object.entries(stats.platforms)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => {
        const percentage = (count / stats.totalEvents * 100).toFixed(1);
        return { platform, count, percentage };
      });
    
    // Calculate category percentages
    const categories = Object.entries(stats.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => {
        const percentage = (count / stats.totalEvents * 100).toFixed(1);
        return { category, count, percentage };
      });
    
    return `
    <section class="summary-section">
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-value">${stats.totalEvents}</div>
          <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Object.keys(stats.platforms).length}</div>
          <div class="stat-label">Platforms</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${startDate}</div>
          <div class="stat-label">First Activity</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${endDate}</div>
          <div class="stat-label">Last Activity</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              Platforms
            </div>
            <div class="card-body">
              <table class="table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  ${platforms.map(p => `
                  <tr>
                    <td><span class="${p.platform.toLowerCase()}-color">${this.getPlatformIcon(p.platform as Platform)}</span> ${p.platform}</td>
                    <td>${p.count}</td>
                    <td>${p.percentage}%</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              Content Types
            </div>
            <div class="card-body">
              <table class="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  ${categories.map(c => `
                  <tr>
                    <td>${this.formatCategoryName(c.category)}</td>
                    <td>${c.count}</td>
                    <td>${c.percentage}%</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
`;
  }
  
  /**
   * Generate activity heatmap chart
   */
  private generateActivityHeatmap(events: TimelineEvent[]): string {
    // Get activity data by date
    const activityByDate = new Map<string, number>();
    const startDate = DateTime.now().minus({ years: 1 });
    
    // Initialize all dates in the past year with zero
    for (let d = startDate; d <= DateTime.now(); d = d.plus({ days: 1 })) {
      activityByDate.set(d.toISODate()!, 0);
    }
    
    // Count events per date
    for (const event of events) {
      const dateKey = event.timestamp.toISODate();
      if (!dateKey) continue;
      
      activityByDate.set(dateKey, (activityByDate.get(dateKey) || 0) + 1);
    }
    
    // Convert to array format for Chart.js
    const activityData = Array.from(activityByDate.entries()).map(([date, count]) => {
      return { x: date, y: count };
    });
    
    return `
    <section class="activity-section">
      <div class="card">
        <div class="card-header">
          Activity Over Time
        </div>
        <div class="card-body">
          <div class="chart-container">
            <canvas id="activity-chart"></canvas>
          </div>
        </div>
      </div>
    </section>
    
    <script>
      // Activity chart data
      const activityData = ${JSON.stringify(activityData)};
    </script>
`;
  }
  
  /**
   * Generate platform distribution chart
   */
  private generatePlatformDistribution(stats: TimelineStats): string {
    const platformData = Object.entries(stats.platforms).map(([platform, count]) => ({
      platform,
      count
    }));
    
    return `
    <section class="platforms-section">
      <div class="card">
        <div class="card-header">
          Platform Distribution
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-8">
              <div class="chart-container">
                <canvas id="platform-chart"></canvas>
              </div>
            </div>
            <div class="col-md-4">
              <h5>Activity by Platform</h5>
              <ul class="list-group">
                ${platformData.sort((a, b) => b.count - a.count).map(p => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <span><span class="${p.platform.toLowerCase()}-color">${this.getPlatformIcon(p.platform as Platform)}</span> ${p.platform}</span>
                  <span class="badge bg-primary rounded-pill">${p.count}</span>
                </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <script>
      // Platform distribution data
      const platformData = ${JSON.stringify(platformData)};
    </script>
`;
  }
  
  /**
   * Generate sentiment trends chart
   */
  private generateSentimentTrends(stats: TimelineStats): string {
    if (!stats.sentiment) return '';
    
    return `
    <section class="sentiment-section">
      <div class="card">
        <div class="card-header">
          Sentiment Analysis
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6">
              <div class="chart-container">
                <canvas id="sentiment-distribution-chart"></canvas>
              </div>
            </div>
            <div class="col-md-6">
              <div class="chart-container">
                <canvas id="sentiment-trend-chart"></canvas>
              </div>
            </div>
          </div>
          
          <div class="row mt-4">
            <div class="col-md-12">
              <table class="table">
                <thead>
                  <tr>
                    <th>Sentiment</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="sentiment-positive">●</span> Positive</td>
                    <td>${stats.sentiment.distribution.positive}</td>
                    <td>${(stats.sentiment.distribution.positive / stats.totalEvents * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td><span class="sentiment-neutral">●</span> Neutral</td>
                    <td>${stats.sentiment.distribution.neutral}</td>
                    <td>${(stats.sentiment.distribution.neutral / stats.totalEvents * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td><span class="sentiment-negative">●</span> Negative</td>
                    <td>${stats.sentiment.distribution.negative}</td>
                    <td>${(stats.sentiment.distribution.negative / stats.totalEvents * 100).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <script>
      // Sentiment distribution data
      const sentimentDistribution = ${JSON.stringify(stats.sentiment.distribution)};
      
      // Sentiment trends over time
      const sentimentTrends = ${JSON.stringify(stats.sentiment.trends)};
    </script>
`;
  }
  
  /**
   * Generate topic distribution chart
   */
  private generateTopicDistribution(stats: TimelineStats): string {
    if (!stats.topics) return '';
    
    const topTopics = stats.topics.topTopics
      .slice(0, 10)
      .map(topic => ({ topic: topic.topic, count: topic.count }));
    
    return `
    <section class="topics-section">
      <div class="card">
        <div class="card-header">
          Topic Analysis
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-7">
              <div class="chart-container">
                <canvas id="topics-chart"></canvas>
              </div>
            </div>
            <div class="col-md-5">
              <h5>Top Topics</h5>
              <div class="list-group">
                ${topTopics.map((t, idx) => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                  <span>${idx + 1}. ${t.topic}</span>
                  <span class="badge bg-primary rounded-pill">${t.count}</span>
                </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <script>
      // Topics data
      const topicsData = ${JSON.stringify(topTopics)};
    </script>
`;
  }
  
  /**
   * Generate entity network visualization
   */
  private generateEntityNetworkChart(stats: TimelineStats): string {
    if (!stats.entities) return '';
    
    const networkData = {
      nodes: [] as any[],
      edges: [] as any[]
    };
    
    // Add top entities as nodes
    let nodeId = 1;
    const entityNodeMap = new Map<string, number>();
    
    // Collect top entities by type
    Object.entries(stats.entities.byType).forEach(([type, entities]) => {
      entities.slice(0, 5).forEach(entity => {
        const id = nodeId++;
        entityNodeMap.set(entity.name, id);
        
        networkData.nodes.push({
          id,
          label: entity.name,
          group: type,
          value: entity.count
        });
      });
    });
    
    // Add co-occurrence edges
    stats.entities.cooccurrences.forEach(cooc => {
      const sourceId = entityNodeMap.get(cooc.source);
      const targetId = entityNodeMap.get(cooc.target);
      
      if (sourceId && targetId) {
        networkData.edges.push({
          from: sourceId,
          to: targetId,
          value: cooc.weight,
          title: `Co-occurs ${cooc.weight} times`
        });
      }
    });
    
    return `
    <section class="network-section">
      <div class="card">
        <div class="card-header">
          Entity Network
        </div>
        <div class="card-body">
          <div id="network-chart"></div>
        </div>
      </div>
    </section>
    
    <script>
      // Network data
      const networkData = ${JSON.stringify(networkData)};
    </script>
`;
  }
  
  /**
   * Generate event list section
   */
  private generateEventListSection(events: TimelineEvent[]): string {
    const recentEvents = events
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
      .slice(0, 100);
    
    return `
    <section class="events-section">
      <div class="card">
        <div class="card-header">
          Recent Events
          <div class="filter-controls float-end">
            <select id="platform-filter" class="form-select form-select-sm d-inline-block" style="width: 120px">
              <option value="all">All Platforms</option>
              ${Array.from(new Set(events.map(e => e.platform))).map(p => 
                `<option value="${p}">${p}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="event-list">
            ${recentEvents.map(event => `
            <div class="event-item" data-platform="${event.platform}">
              <div class="event-time">
                ${event.timestamp.toFormat('LLL dd, yyyy')}
                <br />
                <small>${event.timestamp.toFormat('hh:mm a')}</small>
              </div>
              <div class="event-platform">
                <span class="${event.platform.toLowerCase()}-color">
                  ${this.getPlatformIcon(event.platform)}
                  ${event.platform}
                </span>
              </div>
              <div class="event-content">
                <div class="event-title">${this.escapeHtml(event.title)}</div>
                <div class="event-description">
                  ${this.formatEventContent(event)}
                </div>
                <a href="${event.url}" target="_blank" class="event-link">View Original</a>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
`;
  }
  
  /**
   * Generate dashboard footer with JavaScript
   */
  private generateDashboardFooter(): string {
    const refreshInterval = this.dashboardConfig.refreshInterval || 60;
    
    return `
    <!-- JavaScript Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.2/dist/vis-network.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    
    <script>
      // Initialize charts when DOM is ready
      document.addEventListener('DOMContentLoaded', function() {
        // Platform Filter functionality
        const platformFilter = document.getElementById('platform-filter');
        if (platformFilter) {
          platformFilter.addEventListener('change', function() {
            const platform = this.value;
            const eventItems = document.querySelectorAll('.event-item');
            
            eventItems.forEach(item => {
              if (platform === 'all' || item.dataset.platform === platform) {
                item.style.display = '';
              } else {
                item.style.display = 'none';
              }
            });
          });
        }
        
        // Activity Chart
        const activityCtx = document.getElementById('activity-chart');
        if (activityCtx) {
          new Chart(activityCtx, {
            type: 'bar',
            data: {
              datasets: [{
                label: 'Activity',
                data: activityData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
              }]
            },
            options: {
              scales: {
                x: {
                  type: 'time',
                  time: {
                    unit: 'month'
                  },
                  title: {
                    display: true,
                    text: 'Date'
                  }
                },
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Event Count'
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    title: function(tooltipItems) {
                      return new Date(tooltipItems[0].parsed.x).toLocaleDateString();
                    }
                  }
                }
              }
            }
          });
        }
        
        // Platform Distribution Chart
        const platformCtx = document.getElementById('platform-chart');
        if (platformCtx && typeof platformData !== 'undefined') {
          new Chart(platformCtx, {
            type: 'doughnut',
            data: {
              labels: platformData.map(p => p.platform),
              datasets: [{
                data: platformData.map(p => p.count),
                backgroundColor: [
                  '#1DA1F2', // Twitter
                  '#FF4500', // Reddit
                  '#2B3137', // GitHub
                  '#FFA500', // RSS
                  '#02A79C', // Pastebin
                  '#0077B5', // LinkedIn
                  '#F48024', // StackOverflow
                  '#FF6600', // HackerNews
                  '#00AB6C'  // Medium
                ],
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'right',
                }
              }
            }
          });
        }
        
        // Sentiment Charts
        const sentimentDistributionCtx = document.getElementById('sentiment-distribution-chart');
        if (sentimentDistributionCtx && typeof sentimentDistribution !== 'undefined') {
          new Chart(sentimentDistributionCtx, {
            type: 'doughnut',
            data: {
              labels: ['Positive', 'Neutral', 'Negative'],
              datasets: [{
                data: [
                  sentimentDistribution.positive,
                  sentimentDistribution.neutral,
                  sentimentDistribution.negative
                ],
                backgroundColor: [
                  '#28a745', // Positive
                  '#6c757d', // Neutral
                  '#dc3545'  // Negative
                ],
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom',
                },
                title: {
                  display: true,
                  text: 'Sentiment Distribution'
                }
              }
            }
          });
        }
        
        const sentimentTrendCtx = document.getElementById('sentiment-trend-chart');
        if (sentimentTrendCtx && typeof sentimentTrends !== 'undefined') {
          new Chart(sentimentTrendCtx, {
            type: 'line',
            data: {
              labels: sentimentTrends.map(t => t.date),
              datasets: [{
                label: 'Sentiment Score',
                data: sentimentTrends.map(t => t.score),
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                tension: 0.4
              }]
            },
            options: {
              scales: {
                y: {
                  min: -1,
                  max: 1,
                  title: {
                    display: true,
                    text: 'Sentiment Score'
                  }
                }
              },
              plugins: {
                title: {
                  display: true,
                  text: 'Sentiment Trends Over Time'
                }
              }
            }
          });
        }
        
        // Topics Chart
        const topicsCtx = document.getElementById('topics-chart');
        if (topicsCtx && typeof topicsData !== 'undefined') {
          new Chart(topicsCtx, {
            type: 'bar',
            data: {
              labels: topicsData.map(t => t.topic),
              datasets: [{
                label: 'Occurrences',
                data: topicsData.map(t => t.count),
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
              }]
            },
            options: {
              indexAxis: 'y',
              plugins: {
                title: {
                  display: true,
                  text: 'Top Topics'
                }
              }
            }
          });
        }
        
        // Network Graph
        const networkContainer = document.getElementById('network-chart');
        if (networkContainer && typeof networkData !== 'undefined') {
          // Configure visualization options
          const options = {
            nodes: {
              shape: 'dot',
              scaling: {
                min: 10,
                max: 30,
                label: {
                  enabled: true,
                  min: 14,
                  max: 30
                }
              },
              font: {
                size: 12
              }
            },
            edges: {
              width: 0.15,
              color: { inherit: 'from' },
              smooth: {
                type: 'continuous'
              }
            },
            physics: {
              stabilization: false,
              barnesHut: {
                gravitationalConstant: -80000,
                springConstant: 0.001,
                springLength: 200
              }
            },
            interaction: {
              tooltipDelay: 200,
              hideEdgesOnDrag: true
            },
            groups: {
              person: { color: { background: '#6ACDEB', border: '#3BAFDA' } },
              organization: { color: { background: '#AC92EB', border: '#967ADC' } },
              location: { color: { background: '#8CC152', border: '#A0D468' } },
              hashtag: { color: { background: '#F6BB42', border: '#FFCE54' } },
              other: { color: { background: '#E9573F', border: '#FC6E51' } }
            }
          };
          
          // Initialize the network
          new vis.Network(networkContainer, networkData, options);
        }
      });
      
      // Auto-refresh if configured
      ${refreshInterval > 0 ? `
      setTimeout(function() {
        window.location.reload();
      }, ${refreshInterval * 1000});
      ` : ''}
    </script>
  </div>
</body>
</html>`;
  }
  
  /**
   * Format event content for display
   */
  private formatEventContent(event: TimelineEvent): string {
    // Truncate content for display
    let content = this.escapeHtml(event.content);
    if (content.length > 150) {
      content = content.substring(0, 147) + '...';
    }
    
    // Add sentiment indicator if available
    if (event.sentiment) {
      const sentimentClass = 
        event.sentiment.label === 'positive' ? 'sentiment-positive' :
        event.sentiment.label === 'negative' ? 'sentiment-negative' :
        'sentiment-neutral';
      
      content += `<span class="${sentimentClass}" title="Sentiment: ${event.sentiment.label} (${(event.sentiment.score).toFixed(2)})"> ●</span>`;
    }
    
    // Add entity highlighting
    if (event.entities && event.entities.length > 0) {
      content += '<div class="entity-tags mt-1">';
      for (const entity of event.entities.slice(0, 3)) {
        content += `<span class="badge bg-secondary me-1" title="${entity.type}">${entity.text}</span>`;
      }
      if (event.entities.length > 3) {
        content += `<span class="badge bg-light text-dark">+${event.entities.length - 3} more</span>`;
      }
      content += '</div>';
    }
    
    return content;
  }
  
  /**
   * Get platform icon HTML
   */
  private getPlatformIcon(platform: Platform): string {
    const icons: Record<Platform, string> = {
      twitter: '<i class="fab fa-twitter"></i>',
      reddit: '<i class="fab fa-reddit"></i>',
      github: '<i class="fab fa-github"></i>',
      rss: '<i class="fas fa-rss"></i>',
      pastebin: '<i class="fas fa-paste"></i>'
    };
    
    return icons[platform] || '';
  }
  
  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    return category
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Get color scheme for selected theme
   */
  private getThemeColors(theme: string): string {
    switch (theme) {
      case 'dark':
        return `
          --bg-color: #1a1a1a;
          --text-color: #f5f5f5;
          --muted-text: #aaaaaa;
          --border-color: #444444;
          --card-bg: #2a2a2a;
          --card-header-bg: #333333;
          --stat-card-bg: #333333;
          --link-color: #6da8ff;
          --network-bg: #222222;
        `;
      
      case 'light':
        return `
          --bg-color: #f8f9fa;
          --text-color: #343a40;
          --muted-text: #6c757d;
          --border-color: #dee2e6;
          --card-bg: #ffffff;
          --card-header-bg: #f8f9fa;
          --stat-card-bg: #ffffff;
          --link-color: #007bff;
          --network-bg: #ffffff;
        `;
      
      case 'minimal':
        return `
          --bg-color: #ffffff;
          --text-color: #333333;
          --muted-text: #777777;
          --border-color: #eeeeee;
          --card-bg: #ffffff;
          --card-header-bg: #ffffff;
          --stat-card-bg: #fafafa;
          --link-color: #555555;
          --network-bg: #fafafa;
        `;
      
      case 'colorful':
        return `
          --bg-color: #f5f7fa;
          --text-color: #333333;
          --muted-text: #888888;
          --border-color: #e8e8e8;
          --card-bg: #ffffff;
          --card-header-bg: #4a6cf7;
          --card-header-color: #ffffff;
          --stat-card-bg: #eff2ff;
          --link-color: #4a6cf7;
          --network-bg: #eff6ff;
        `;
      
      default: // Default theme
        return `
          --bg-color: #f5f7fa;
          --text-color: #333333;
          --muted-text: #777777;
          --border-color: #e0e0e0;
          --card-bg: #ffffff;
          --card-header-bg: #f0f3f5;
          --stat-card-bg: #f5f7fa;
          --link-color: #3498db;
          --network-bg: #f9f9f9;
        `;
    }
  }
  
  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}