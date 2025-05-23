/**
 * CSV Exporter Module
 * Exports timeline data in CSV format for spreadsheet analysis
 */

import fs from 'fs';
import path from 'path';
import { TimelineEvent, TimelineConfig, ExportConfig } from '../../types.js';

export class CSVExporter {
  /**
   * Export timeline events to CSV file
   */
  async export(
    events: TimelineEvent[], 
    config: TimelineConfig,
    exportConfig?: ExportConfig
  ): Promise<string> {
    // Create output directory if it doesn't exist
    const outputDir = exportConfig?.outputDir || config.output.outputDir || './timeline-output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate CSV content
    const csvContent = this.generateCSV(events);
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = exportConfig?.fileNameTemplate || 
      `timeline-${config.target.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.csv`;
    
    const outputPath = path.join(outputDir, filename);
    
    // Write to file
    await fs.promises.writeFile(outputPath, csvContent, 'utf-8');
    
    return outputPath;
  }
  
  /**
   * Generate CSV content from timeline events
   */
  private generateCSV(events: TimelineEvent[]): string {
    // Define CSV columns
    const columns = [
      'id',
      'timestamp',
      'platform',
      'category',
      'username',
      'title',
      'content',
      'url',
      'language',
      'sentiment_score',
      'sentiment_label',
      'location',
      'topics',
      'entities'
    ];
    
    // Create CSV header
    let csv = columns.join(',') + '\n';
    
    // Add event rows
    for (const event of events) {
      const row = [
        this.escapeCSVField(event.id),
        this.escapeCSVField(event.timestamp.toISO() || ''),
        this.escapeCSVField(event.platform),
        this.escapeCSVField(event.category),
        this.escapeCSVField(event.username),
        this.escapeCSVField(event.title),
        this.escapeCSVField(event.content),
        this.escapeCSVField(event.url),
        this.escapeCSVField(event.language || ''),
        this.escapeCSVField(event.sentiment ? event.sentiment.score.toString() : ''),
        this.escapeCSVField(event.sentiment ? event.sentiment.label : ''),
        this.escapeCSVField(event.location ? 
          `${event.location.lat},${event.location.lng}` : ''),
        this.escapeCSVField(event.topics ? event.topics.join(';') : ''),
        this.escapeCSVField(event.entities ? 
          event.entities.map(e => `${e.type}:${e.text}`).join(';') : '')
      ];
      
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }
  
  /**
   * Escape and format a value for CSV inclusion
   */
  private escapeCSVField(value: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Convert to string
    const stringValue = String(value);
    
    // Check if we need to escape the value
    const needsEscaping = 
      stringValue.includes(',') || 
      stringValue.includes('"') || 
      stringValue.includes('\n') ||
      stringValue.includes('\r');
    
    if (needsEscaping) {
      // Escape double quotes with double quotes and wrap in quotes
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }
  
  /**
   * Export a subset of events by date range
   */
  async exportByDateRange(
    events: TimelineEvent[], 
    config: TimelineConfig,
    startDate: string, 
    endDate: string,
    exportConfig?: ExportConfig
  ): Promise<string> {
    // Filter events by date range
    const filteredEvents = events.filter(event => {
      const eventDate = event.timestamp.toISO();
      return eventDate >= startDate && eventDate <= endDate;
    });
    
    // Update export filename
    const dateRangeSuffix = `${startDate.substring(0, 10)}_to_${endDate.substring(0, 10)}`;
    const exportConfigWithDateRange = {
      ...exportConfig,
      fileNameTemplate: exportConfig?.fileNameTemplate ?
        exportConfig.fileNameTemplate.replace('.csv', `_${dateRangeSuffix}.csv`) :
        `timeline_${dateRangeSuffix}.csv`
    };
    
    // Export filtered events
    return this.export(filteredEvents, config, exportConfigWithDateRange);
  }
  
  /**
   * Export events by platform
   */
  async exportByPlatform(
    events: TimelineEvent[], 
    config: TimelineConfig,
    platform: string,
    exportConfig?: ExportConfig
  ): Promise<string> {
    // Filter events by platform
    const filteredEvents = events.filter(event => event.platform === platform);
    
    // Update export filename
    const exportConfigWithPlatform = {
      ...exportConfig,
      fileNameTemplate: exportConfig?.fileNameTemplate ?
        exportConfig.fileNameTemplate.replace('.csv', `_${platform}.csv`) :
        `timeline_${platform}.csv`
    };
    
    // Export filtered events
    return this.export(filteredEvents, config, exportConfigWithPlatform);
  }
  
  /**
   * Export sentiment analysis in CSV format
   */
  async exportSentimentAnalysis(
    events: TimelineEvent[],
    config: TimelineConfig,
    exportConfig?: ExportConfig
  ): Promise<string> {
    // Create output directory if it doesn't exist
    const outputDir = exportConfig?.outputDir || config.output.outputDir || './timeline-output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Filter events with sentiment data
    const eventsWithSentiment = events.filter(event => event.sentiment);
    
    // Generate CSV header
    let csv = 'timestamp,platform,category,sentiment_score,sentiment_magnitude,sentiment_label,content\n';
    
    // Add event rows
    for (const event of eventsWithSentiment) {
      const row = [
        this.escapeCSVField(event.timestamp.toISO() || ''),
        this.escapeCSVField(event.platform),
        this.escapeCSVField(event.category),
        this.escapeCSVField(event.sentiment!.score.toString()),
        this.escapeCSVField(event.sentiment!.magnitude.toString()),
        this.escapeCSVField(event.sentiment!.label),
        this.escapeCSVField(event.content)
      ];
      
      csv += row.join(',') + '\n';
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sentiment-analysis-${config.target.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.csv`;
    
    const outputPath = path.join(outputDir, filename);
    
    // Write to file
    await fs.promises.writeFile(outputPath, csv, 'utf-8');
    
    return outputPath;
  }
}