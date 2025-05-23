/**
 * JSON Exporter Module
 * Exports timeline data in structured JSON format
 */

import fs from 'fs';
import path from 'path';
import { TimelineEvent, TimelineConfig, ExportConfig } from '../../types.js';

export class JSONExporter {
  /**
   * Export timeline events to structured JSON file
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
    
    // Format the data
    const jsonData = this.formatTimelineData(events, config);
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = exportConfig?.fileNameTemplate || 
      `timeline-${config.target.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.json`;
    
    const outputPath = path.join(outputDir, filename);
    
    // Write to file
    await fs.promises.writeFile(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    return outputPath;
  }
  
  /**
   * Format timeline data for JSON export
   */
  private formatTimelineData(events: TimelineEvent[], config: TimelineConfig): any {
    // Clean up events for JSON serialization
    const cleanEvents = events.map(event => {
      // Clone event to avoid mutating original
      const cleanEvent = { ...event };
      
      // Convert DateTime to ISO string
      cleanEvent.timestamp = event.timestamp.toISO();
      
      // Remove circular references or non-serializable data if any
      return cleanEvent;
    });
    
    // Create metadata
    const metadata = {
      version: '1.0',
      generated: new Date().toISOString(),
      target: config.target,
      timezone: config.timezone,
      platforms: config.platforms,
      dateRange: config.dateRange ? {
        start: config.dateRange.start.toISO(),
        end: config.dateRange.end.toISO()
      } : null,
      totalEvents: events.length
    };
    
    // Return structured data
    return {
      metadata,
      events: cleanEvents
    };
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
        exportConfig.fileNameTemplate.replace('.json', `_${dateRangeSuffix}.json`) :
        `timeline_${dateRangeSuffix}.json`
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
        exportConfig.fileNameTemplate.replace('.json', `_${platform}.json`) :
        `timeline_${platform}.json`
    };
    
    // Export filtered events
    return this.export(filteredEvents, config, exportConfigWithPlatform);
  }
}