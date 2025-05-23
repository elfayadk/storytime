/**
 * Advanced Timeline Builder Integration Module
 * Combines all enhanced features into a unified workflow
 */

import { DateTime } from 'luxon';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';

import { 
  TimelineEvent, 
  TimelineConfig, 
  PlatformConfigs,
  NLPConfig,
  NetworkConfig,
  VisualizationConfig,
  DashboardConfig,
  ExportConfig,
  TimelineStats,
  GeoAnalysisConfig
} from '../types.js';

import { TimelineProcessor } from '../timeline-processor.js';
import { NLPProcessor } from '../analysis/nlp-processor.js';
import { NetworkAnalyzer, NetworkGraph } from '../analysis/network/network-analyzer.js';
import { GeoAnalyzer } from '../analysis/geo/geo-analyzer.js';
import { DashboardGenerator } from '../visualization/dashboard-generator.js';

// Structured exporters
import { JSONExporter } from '../exporters/structured/json-exporter.js';
import { CSVExporter } from '../exporters/structured/csv-exporter.js';
import { XMLExporter } from '../exporters/structured/xml-exporter.js';

// Traditional exporters
import { MarkdownExporter } from '../exporters/markdown.js';
import { HTMLExporter } from '../exporters/html.js';

export class AdvancedTimelineBuilder {
  private config: TimelineConfig;
  private platformConfigs: PlatformConfigs;
  private nlpConfig: NLPConfig;
  private networkConfig: NetworkConfig;
  private geoConfig: GeoAnalysisConfig;
  private visualConfig: VisualizationConfig;
  private dashboardConfig: DashboardConfig;
  private exportConfig: ExportConfig;
  
  constructor(
    config: TimelineConfig,
    platformConfigs: PlatformConfigs,
    options: {
      nlpConfig?: NLPConfig,
      networkConfig?: NetworkConfig,
      geoConfig?: GeoAnalysisConfig,
      visualConfig?: VisualizationConfig,
      dashboardConfig?: DashboardConfig,
      exportConfig?: ExportConfig
    } = {}
  ) {
    this.config = config;
    this.platformConfigs = platformConfigs;
    
    // Initialize with defaults or provided configs
    this.nlpConfig = options.nlpConfig || {
      languageDetection: { enabled: true },
      entityExtraction: { enabled: true },
      sentimentAnalysis: { enabled: true },
      topicModeling: { enabled: true },
      keywordExtraction: { enabled: true }
    };
    
    this.networkConfig = options.networkConfig || { 
      enabled: true 
    };
    
    this.geoConfig = options.geoConfig || { 
      enabled: true 
    };
    
    this.visualConfig = options.visualConfig || {
      theme: 'default',
      interactive: {
        filtering: true,
        search: true,
        clustering: false,
        map: true
      }
    };
    
    this.dashboardConfig = options.dashboardConfig || {
      enabled: true,
      title: `Digital Timeline for ${config.target}`,
      refreshInterval: 0,
      charts: {
        activityHeatmap: true,
        platformDistribution: true,
        sentimentTrends: true,
        topicDistribution: true,
        entityNetwork: true
      }
    };
    
    this.exportConfig = options.exportConfig || {
      formats: {
        markdown: true,
        html: true,
        json: false,
        csv: false
      },
      outputDir: config.output.outputDir || './timeline-output',
      splitByDate: false
    };
  }
  
  /**
   * Build an enhanced timeline with all advanced features
   */
  async buildAdvancedTimeline(): Promise<{
    events: TimelineEvent[];
    stats: TimelineStats;
    network?: NetworkGraph;
    outputFiles: string[];
  }> {
    console.log(chalk.cyan('🚀 Advanced Cross-Platform Timeline Builder'));
    console.log(chalk.gray('=========================================\n'));
    
    // Track output files
    const outputFiles: string[] = [];
    
    // Step 1: Basic timeline processing
    console.log(chalk.blue('📊 Step 1: Collecting and processing timeline events'));
    const spinner1 = ora('Processing timeline events...').start();
    
    const processor = new TimelineProcessor(this.config, this.platformConfigs);
    const events = await processor.buildTimeline();
    
    spinner1.succeed(`Collected ${events.length} events from ${this.config.platforms.length} platforms`);
    
    if (events.length === 0) {
      console.log(chalk.yellow('⚠️  No events found. Please check your configuration and try again.'));
      return { events: [], stats: this.createEmptyStats(), outputFiles: [] };
    }
    
    // Step 2: NLP enrichment
    let enrichedEvents = [...events];
    
    if (this.config.analysis?.entities || this.config.analysis?.sentiment || this.config.analysis?.topics) {
      console.log(chalk.blue('\n🧠 Step 2: Applying NLP analysis'));
      const spinner2 = ora('Enriching events with NLP analysis...').start();
      
      const nlpProcessor = new NLPProcessor(this.nlpConfig);
      enrichedEvents = await nlpProcessor.processEvents(events);
      
      const entitiesCount = enrichedEvents.filter(e => e.entities && e.entities.length > 0).length;
      const sentimentCount = enrichedEvents.filter(e => e.sentiment).length;
      const topicsCount = enrichedEvents.filter(e => e.topics && e.topics.length > 0).length;
      
      spinner2.succeed(`Applied NLP analysis (${entitiesCount} with entities, ${sentimentCount} with sentiment, ${topicsCount} with topics)`);
    } else {
      console.log(chalk.gray('\n🧠 Step 2: NLP analysis skipped (disabled in config)'));
    }
    
    // Step 3: Geo-enrichment
    if (this.config.analysis?.geotagging) {
      console.log(chalk.blue('\n🌍 Step 3: Applying geo-analysis'));
      const spinner3 = ora('Enriching events with geo information...').start();
      
      const geoAnalyzer = new GeoAnalyzer(this.geoConfig);
      enrichedEvents = await geoAnalyzer.enhanceEventsWithGeoData(enrichedEvents);
      
      const geoCount = enrichedEvents.filter(e => e.location).length;
      
      if (geoCount > 0) {
        const topLocations = geoAnalyzer.getTopLocations(enrichedEvents, 3);
        const locationNames = topLocations.map(loc => loc.location.name || 'Unknown').join(', ');
        spinner3.succeed(`Enhanced ${geoCount} events with geo data (Top locations: ${locationNames})`);
        
        // Generate GeoJSON for mapping
        const geoJsonData = geoAnalyzer.generateGeoJSON(enrichedEvents);
        const geoJsonPath = `${this.exportConfig.outputDir}/geo-data.json`;
        await fs.promises.writeFile(geoJsonPath, JSON.stringify(geoJsonData, null, 2));
        outputFiles.push(geoJsonPath);
        
        console.log(chalk.gray(`  📍 GeoJSON map data exported to ${geoJsonPath}`));
      } else {
        spinner3.info('No events could be geo-tagged');
      }
    } else {
      console.log(chalk.gray('\n🌍 Step 3: Geo-analysis skipped (disabled in config)'));
    }
    
    // Step 4: Calculate statistics
    console.log(chalk.blue('\n📈 Step 4: Generating statistics and insights'));
    const spinner4 = ora('Calculating timeline statistics...').start();
    
    const stats = this.calculateAdvancedStats(enrichedEvents);
    
    spinner4.succeed('Generated comprehensive timeline statistics and insights');
    
    // Step 5: Network analysis
    let networkGraph: NetworkGraph | undefined;
    
    if (this.config.analysis?.network) {
      console.log(chalk.blue('\n🕸️  Step 5: Performing network analysis'));
      const spinner5 = ora('Analyzing entity and event relationships...').start();
      
      const networkAnalyzer = new NetworkAnalyzer(this.networkConfig);
      networkGraph = await networkAnalyzer.buildNetworkGraph(enrichedEvents);
      
      spinner5.succeed(`Built network graph with ${networkGraph.nodes.length} nodes and ${networkGraph.edges.length} edges`);
      
      // Export network data
      if (networkGraph.nodes.length > 0) {
        const networkDataPath = `${this.exportConfig.outputDir}/network-data.json`;
        await fs.promises.writeFile(networkDataPath, JSON.stringify(networkGraph, null, 2));
        outputFiles.push(networkDataPath);
        
        // Export in GEXF format for Gephi
        const gexfPath = `${this.exportConfig.outputDir}/network-data.gexf`;
        const gexfData = await networkAnalyzer.exportNetworkGraph(networkGraph, 'gexf');
        await fs.promises.writeFile(gexfPath, gexfData);
        outputFiles.push(gexfPath);
        
        console.log(chalk.gray(`  🔗 Network data exported to ${networkDataPath} and ${gexfPath}`));
      }
    } else {
      console.log(chalk.gray('\n🕸️  Step 5: Network analysis skipped (disabled in config)'));
    }
    
    // Step 6: Generate visualization dashboard
    if (this.dashboardConfig.enabled) {
      console.log(chalk.blue('\n🖥️  Step 6: Generating interactive dashboard'));
      const spinner6 = ora('Building interactive dashboard...').start();
      
      const dashboardGenerator = new DashboardGenerator(this.dashboardConfig, this.visualConfig);
      const dashboardHtml = await dashboardGenerator.generateDashboard(enrichedEvents, stats);
      
      const dashboardPath = `${this.exportConfig.outputDir}/dashboard.html`;
      await fs.promises.writeFile(dashboardPath, dashboardHtml);
      outputFiles.push(dashboardPath);
      
      spinner6.succeed(`Interactive dashboard generated at ${dashboardPath}`);
    } else {
      console.log(chalk.gray('\n🖥️  Step 6: Dashboard generation skipped (disabled in config)'));
    }
    
    // Step 7: Export data in various formats
    console.log(chalk.blue('\n💾 Step 7: Exporting timeline in various formats'));
    const spinner7 = ora('Exporting timeline data...').start();
    
    // Track export operations
    const exportPromises: Promise<string>[] = [];
    
    // Standard exporters (Markdown & HTML)
    if (this.exportConfig.formats.markdown) {
      const markdownExporter = new MarkdownExporter();
      exportPromises.push(markdownExporter.export(enrichedEvents, this.config));
    }
    
    if (this.exportConfig.formats.html) {
      const htmlExporter = new HTMLExporter();
      exportPromises.push(htmlExporter.export(enrichedEvents, this.config));
    }
    
    // Structured data exporters
    if (this.exportConfig.formats.json) {
      const jsonExporter = new JSONExporter();
      exportPromises.push(jsonExporter.export(enrichedEvents, this.config, this.exportConfig));
    }
    
    if (this.exportConfig.formats.csv) {
      const csvExporter = new CSVExporter();
      exportPromises.push(csvExporter.export(enrichedEvents, this.config, this.exportConfig));
      
      // Also export sentiment analysis if available
      if (enrichedEvents.some(e => e.sentiment)) {
        exportPromises.push(csvExporter.exportSentimentAnalysis(enrichedEvents, this.config, this.exportConfig));
      }
    }
    
    // XML export is optional
    const xmlExporter = new XMLExporter();
    exportPromises.push(xmlExporter.export(enrichedEvents, this.config, this.exportConfig));
    
    // Split exports by date if configured
    if (this.exportConfig.splitByDate && enrichedEvents.length > 0) {
      // Get min and max dates
      const dates = enrichedEvents.map(e => e.timestamp.toISODate())
        .filter((date): date is string => date !== null)
        .sort();
      
      if (dates.length > 0) {
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];
        
        // Split by month
        const startDate = DateTime.fromISO(minDate).startOf('month');
        const endDate = DateTime.fromISO(maxDate).endOf('month');
        
        let currentDate = startDate;
        while (currentDate <= endDate) {
          const monthStart = currentDate.toISO()!;
          const monthEnd = currentDate.endOf('month').toISO()!;
          
          if (this.exportConfig.formats.json) {
            const jsonExporter = new JSONExporter();
            exportPromises.push(jsonExporter.exportByDateRange(
              enrichedEvents, this.config, monthStart, monthEnd, this.exportConfig
            ));
          }
          
          currentDate = currentDate.plus({ months: 1 });
        }
      }
    }
    
    // Wait for all exports to complete
    const exportedFiles = await Promise.all(exportPromises);
    outputFiles.push(...exportedFiles);
    
    spinner7.succeed(`Exported timeline in ${exportPromises.length} formats`);
    
    console.log(chalk.cyan('\n✨ Advanced timeline building complete!'));
    console.log(chalk.gray('----------------------------------------'));
    console.log(chalk.gray(`Timeline for: ${this.config.target}`));
    console.log(chalk.gray(`Total events: ${enrichedEvents.length}`));
    console.log(chalk.gray(`Output files: ${outputFiles.length}`));
    console.log(chalk.gray(`Output directory: ${this.exportConfig.outputDir}`));
    
    return {
      events: enrichedEvents,
      stats,
      network: networkGraph,
      outputFiles
    };
  }
  
  /**
   * Calculate advanced statistics from enriched events
   */
  private calculateAdvancedStats(events: TimelineEvent[]): TimelineStats {
    if (events.length === 0) {
      return this.createEmptyStats();
    }
    
    // Start with basic stats
    const stats: TimelineStats = {
      totalEvents: events.length,
      platforms: {} as Record<Platform, number>,
      categories: {} as Record<string, number>,
      dateRange: {
        start: events.length > 0 ? events[0].timestamp : null,
        end: events.length > 0 ? events[events.length - 1].timestamp : null
      }
    };
    
    // Count by platform and category
    for (const event of events) {
      stats.platforms[event.platform] = (stats.platforms[event.platform] || 0) + 1;
      stats.categories[event.category] = (stats.categories[event.category] || 0) + 1;
    }
    
    // Calculate activity by time
    stats.activityByTime = {
      hourOfDay: {},
      dayOfWeek: {},
      byMonth: {}
    };
    
    // Initialize hours
    for (let i = 0; i < 24; i++) {
      stats.activityByTime.hourOfDay[i.toString()] = 0;
    }
    
    // Initialize days
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const day of days) {
      stats.activityByTime.dayOfWeek[day] = 0;
    }
    
    // Initialize months
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    for (const month of months) {
      stats.activityByTime.byMonth[month] = 0;
    }
    
    // Calculate activity distribution
    for (const event of events) {
      const hour = event.timestamp.hour;
      const day = days[event.timestamp.weekday % 7];
      const month = months[event.timestamp.month - 1];
      
      stats.activityByTime.hourOfDay[hour.toString()]++;
      stats.activityByTime.dayOfWeek[day]++;
      stats.activityByTime.byMonth[month]++;
    }
    
    // Entity statistics if available
    if (events.some(e => e.entities && e.entities.length > 0)) {
      stats.entities = {
        byType: {} as Record<EntityType, {name: string, count: number}[]>,
        cooccurrences: []
      };
      
      // Initialize entity types
      const entityTypes: EntityType[] = [
        'person', 'organization', 'location', 'product', 'event',
        'date', 'url', 'email', 'phone', 'hashtag', 'mention', 'keyword', 'other'
      ];
      
      for (const type of entityTypes) {
        stats.entities.byType[type] = [];
      }
      
      // Count entities by type
      const entityCounts = new Map<string, {type: EntityType, count: number}>();
      
      for (const event of events) {
        if (!event.entities) continue;
        
        const eventEntities = new Set<string>(); // For co-occurrence tracking
        
        for (const entity of event.entities) {
          const key = `${entity.type}:${entity.text}`;
          
          if (entityCounts.has(key)) {
            entityCounts.get(key)!.count++;
          } else {
            entityCounts.set(key, {
              type: entity.type,
              count: 1
            });
          }
          
          eventEntities.add(key);
        }
        
        // Track co-occurrences
        const entitiesArray = Array.from(eventEntities);
        for (let i = 0; i < entitiesArray.length; i++) {
          for (let j = i + 1; j < entitiesArray.length; j++) {
            const [source, target] = [entitiesArray[i], entitiesArray[j]].sort();
            
            // Extract entity names from keys
            const sourceName = source.split(':').slice(1).join(':');
            const targetName = target.split(':').slice(1).join(':');
            
            // Check if this pair already exists
            const existingPair = stats.entities.cooccurrences.find(
              pair => pair.source === sourceName && pair.target === targetName
            );
            
            if (existingPair) {
              existingPair.weight++;
            } else {
              stats.entities.cooccurrences.push({
                source: sourceName,
                target: targetName,
                weight: 1
              });
            }
          }
        }
      }
      
      // Convert entity counts to arrays by type
      for (const [key, data] of entityCounts.entries()) {
        const name = key.split(':').slice(1).join(':');
        
        if (!stats.entities.byType[data.type]) {
          stats.entities.byType[data.type] = [];
        }
        
        stats.entities.byType[data.type].push({
          name,
          count: data.count
        });
      }
      
      // Sort each type by count descending and limit to top 10
      for (const type of entityTypes) {
        if (stats.entities.byType[type]) {
          stats.entities.byType[type].sort((a, b) => b.count - a.count);
          stats.entities.byType[type] = stats.entities.byType[type].slice(0, 10);
        }
      }
      
      // Sort co-occurrences by weight and limit to top 50
      stats.entities.cooccurrences.sort((a, b) => b.weight - a.weight);
      stats.entities.cooccurrences = stats.entities.cooccurrences.slice(0, 50);
    }
    
    // Topic statistics if available
    if (events.some(e => e.topics && e.topics.length > 0)) {
      stats.topics = {
        topTopics: [],
        trends: {}
      };
      
      // Count topics
      const topicCounts = new Map<string, number>();
      const topicsByDate = new Map<string, Map<string, number>>();
      
      for (const event of events) {
        if (!event.topics) continue;
        
        // Get date for trend analysis
        const dateKey = event.timestamp.toFormat('yyyy-MM');
        
        if (!topicsByDate.has(dateKey)) {
          topicsByDate.set(dateKey, new Map<string, number>());
        }
        
        for (const topic of event.topics) {
          // Overall count
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
          
          // Count by date
          const dateTopics = topicsByDate.get(dateKey)!;
          dateTopics.set(topic, (dateTopics.get(topic) || 0) + 1);
        }
      }
      
      // Convert to array and sort
      stats.topics.topTopics = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      // Calculate trends for top topics
      const topTopicNames = stats.topics.topTopics.slice(0, 5).map(t => t.topic);
      
      for (const topic of topTopicNames) {
        stats.topics.trends[topic] = [];
        
        // For each date where there's data
        for (const [date, counts] of topicsByDate.entries()) {
          const count = counts.get(topic) || 0;
          stats.topics.trends[topic].push({ date, count });
        }
        
        // Sort by date
        stats.topics.trends[topic].sort((a, b) => a.date.localeCompare(b.date));
      }
    }
    
    // Sentiment statistics if available
    if (events.some(e => e.sentiment)) {
      stats.sentiment = {
        average: 0,
        distribution: {
          positive: 0,
          negative: 0,
          neutral: 0
        },
        trends: []
      };
      
      let totalScore = 0;
      let countWithSentiment = 0;
      
      // Group by date for trends
      const sentimentByDate = new Map<string, {sum: number, count: number}>();
      
      for (const event of events) {
        if (!event.sentiment) continue;
        
        // Count by label
        stats.sentiment.distribution[event.sentiment.label]++;
        
        // Add to average
        totalScore += event.sentiment.score;
        countWithSentiment++;
        
        // Add to trends
        const dateKey = event.timestamp.toFormat('yyyy-MM');
        
        if (!sentimentByDate.has(dateKey)) {
          sentimentByDate.set(dateKey, { sum: 0, count: 0 });
        }
        
        const dateData = sentimentByDate.get(dateKey)!;
        dateData.sum += event.sentiment.score;
        dateData.count++;
      }
      
      // Calculate average
      stats.sentiment.average = countWithSentiment > 0 
        ? totalScore / countWithSentiment 
        : 0;
      
      // Calculate trends
      stats.sentiment.trends = Array.from(sentimentByDate.entries())
        .map(([date, data]) => ({
          date,
          score: data.sum / data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    
    return stats;
  }
  
  /**
   * Create empty statistics object
   */
  private createEmptyStats(): TimelineStats {
    return {
      totalEvents: 0,
      platforms: {} as Record<Platform, number>,
      categories: {} as Record<string, number>,
      dateRange: {
        start: null,
        end: null
      }
    };
  }
}