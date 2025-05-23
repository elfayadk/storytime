/**
 * XML Exporter Module
 * Exports timeline data in XML format for interoperability
 */

import fs from 'fs';
import path from 'path';
import { TimelineEvent, TimelineConfig, ExportConfig } from '../../types.js';

export class XMLExporter {
  /**
   * Export timeline events to XML file
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
    
    // Generate XML content
    const xmlContent = this.generateXML(events, config);
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = exportConfig?.fileNameTemplate || 
      `timeline-${config.target.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.xml`;
    
    const outputPath = path.join(outputDir, filename);
    
    // Write to file
    await fs.promises.writeFile(outputPath, xmlContent, 'utf-8');
    
    return outputPath;
  }
  
  /**
   * Generate XML content from timeline events
   */
  private generateXML(events: TimelineEvent[], config: TimelineConfig): string {
    // XML header
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<timeline>\n';
    
    // Add metadata
    xml += '  <metadata>\n';
    xml += `    <version>1.0</version>\n`;
    xml += `    <generated>${new Date().toISOString()}</generated>\n`;
    xml += `    <target>${this.escapeXml(config.target)}</target>\n`;
    xml += `    <timezone>${this.escapeXml(config.timezone)}</timezone>\n`;
    
    // Add platforms
    xml += '    <platforms>\n';
    for (const platform of config.platforms) {
      xml += `      <platform>${this.escapeXml(platform)}</platform>\n`;
    }
    xml += '    </platforms>\n';
    
    // Add date range if specified
    if (config.dateRange) {
      xml += '    <dateRange>\n';
      xml += `      <start>${config.dateRange.start.toISO()}</start>\n`;
      xml += `      <end>${config.dateRange.end.toISO()}</end>\n`;
      xml += '    </dateRange>\n';
    }
    
    xml += `    <totalEvents>${events.length}</totalEvents>\n`;
    xml += '  </metadata>\n\n';
    
    // Add events
    xml += '  <events>\n';
    
    for (const event of events) {
      xml += '    <event>\n';
      xml += `      <id>${this.escapeXml(event.id)}</id>\n`;
      xml += `      <platform>${this.escapeXml(event.platform)}</platform>\n`;
      xml += `      <category>${this.escapeXml(event.category)}</category>\n`;
      xml += `      <timestamp>${event.timestamp.toISO()}</timestamp>\n`;
      xml += `      <originalTimestamp>${this.escapeXml(event.originalTimestamp)}</originalTimestamp>\n`;
      xml += `      <title>${this.escapeXml(event.title)}</title>\n`;
      xml += `      <content>${this.escapeXml(event.content)}</content>\n`;
      xml += `      <url>${this.escapeXml(event.url)}</url>\n`;
      xml += `      <username>${this.escapeXml(event.username)}</username>\n`;
      
      // Add optional fields if present
      if (event.language) {
        xml += `      <language>${this.escapeXml(event.language)}</language>\n`;
      }
      
      // Add location if present
      if (event.location) {
        xml += '      <location>\n';
        xml += `        <lat>${event.location.lat}</lat>\n`;
        xml += `        <lng>${event.location.lng}</lng>\n`;
        if (event.location.name) {
          xml += `        <name>${this.escapeXml(event.location.name)}</name>\n`;
        }
        if (event.location.address) {
          xml += `        <address>${this.escapeXml(event.location.address)}</address>\n`;
        }
        if (event.location.countryCode) {
          xml += `        <countryCode>${this.escapeXml(event.location.countryCode)}</countryCode>\n`;
        }
        xml += '      </location>\n';
      }
      
      // Add sentiment if present
      if (event.sentiment) {
        xml += '      <sentiment>\n';
        xml += `        <score>${event.sentiment.score}</score>\n`;
        xml += `        <magnitude>${event.sentiment.magnitude}</magnitude>\n`;
        xml += `        <label>${this.escapeXml(event.sentiment.label)}</label>\n`;
        xml += '      </sentiment>\n';
      }
      
      // Add entities if present
      if (event.entities && event.entities.length > 0) {
        xml += '      <entities>\n';
        for (const entity of event.entities) {
          xml += '        <entity>\n';
          xml += `          <text>${this.escapeXml(entity.text)}</text>\n`;
          xml += `          <type>${this.escapeXml(entity.type)}</type>\n`;
          xml += `          <confidence>${entity.confidence}</confidence>\n`;
          if (entity.metadata) {
            xml += '          <metadata>\n';
            for (const [key, value] of Object.entries(entity.metadata)) {
              xml += `            <${key}>${this.escapeXml(String(value))}</${key}>\n`;
            }
            xml += '          </metadata>\n';
          }
          xml += '        </entity>\n';
        }
        xml += '      </entities>\n';
      }
      
      // Add media if present
      if (event.media && event.media.length > 0) {
        xml += '      <media>\n';
        for (const item of event.media) {
          xml += '        <mediaItem>\n';
          xml += `          <type>${this.escapeXml(item.type)}</type>\n`;
          xml += `          <url>${this.escapeXml(item.url)}</url>\n`;
          if (item.description) {
            xml += `          <description>${this.escapeXml(item.description)}</description>\n`;
          }
          if (item.dimensions) {
            xml += '          <dimensions>\n';
            xml += `            <width>${item.dimensions.width}</width>\n`;
            xml += `            <height>${item.dimensions.height}</height>\n`;
            xml += '          </dimensions>\n';
          }
          xml += '        </mediaItem>\n';
        }
        xml += '      </media>\n';
      }
      
      // Add metrics if present
      if (event.metrics) {
        xml += '      <metrics>\n';
        for (const [key, value] of Object.entries(event.metrics)) {
          if (value !== undefined) {
            xml += `        <${key}>${value}</${key}>\n`;
          }
        }
        xml += '      </metrics>\n';
      }
      
      // Add topics if present
      if (event.topics && event.topics.length > 0) {
        xml += '      <topics>\n';
        for (const topic of event.topics) {
          xml += `        <topic>${this.escapeXml(topic)}</topic>\n`;
        }
        xml += '      </topics>\n';
      }
      
      // Add relations if present
      if (event.relations && event.relations.length > 0) {
        xml += '      <relations>\n';
        for (const relation of event.relations) {
          xml += '        <relation>\n';
          xml += `          <type>${this.escapeXml(relation.type)}</type>\n`;
          xml += `          <targetId>${this.escapeXml(relation.targetId)}</targetId>\n`;
          if (relation.context) {
            xml += `          <context>${this.escapeXml(relation.context)}</context>\n`;
          }
          xml += '        </relation>\n';
        }
        xml += '      </relations>\n';
      }
      
      // Add platform-specific metadata
      if (Object.keys(event.metadata).length > 0) {
        xml += '      <metadata>\n';
        this.serializeMetadataToXML(event.metadata, xml, 8);
        xml += '      </metadata>\n';
      }
      
      xml += '    </event>\n';
    }
    
    xml += '  </events>\n';
    xml += '</timeline>';
    
    return xml;
  }
  
  /**
   * Recursively serialize metadata object to XML
   */
  private serializeMetadataToXML(
    metadata: Record<string, any>, 
    xml: string,
    indentLevel: number
  ): string {
    const indent = ' '.repeat(indentLevel);
    
    for (const [key, value] of Object.entries(metadata)) {
      // Skip undefined or functions
      if (value === undefined || typeof value === 'function') {
        continue;
      }
      
      // Handle null
      if (value === null) {
        xml += `${indent}<${key} nil="true"/>\n`;
        continue;
      }
      
      // Handle different value types
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          // Handle arrays
          xml += `${indent}<${key} type="array">\n`;
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              xml += `${indent}  <item>\n`;
              this.serializeMetadataToXML(item, xml, indentLevel + 4);
              xml += `${indent}  </item>\n`;
            } else {
              xml += `${indent}  <item>${this.escapeXml(String(item))}</item>\n`;
            }
          }
          xml += `${indent}</${key}>\n`;
        } else {
          // Handle nested objects
          xml += `${indent}<${key}>\n`;
          this.serializeMetadataToXML(value, xml, indentLevel + 2);
          xml += `${indent}</${key}>\n`;
        }
      } else {
        // Handle primitive types
        xml += `${indent}<${key}>${this.escapeXml(String(value))}</${key}>\n`;
      }
    }
    
    return xml;
  }
  
  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
      return eventDate && eventDate >= startDate && eventDate <= endDate;
    });
    
    // Update export filename
    const dateRangeSuffix = `${startDate.substring(0, 10)}_to_${endDate.substring(0, 10)}`;
    const exportConfigWithDateRange = {
      ...exportConfig,
      fileNameTemplate: exportConfig?.fileNameTemplate ?
        exportConfig.fileNameTemplate.replace('.xml', `_${dateRangeSuffix}.xml`) :
        `timeline_${dateRangeSuffix}.xml`
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
        exportConfig.fileNameTemplate.replace('.xml', `_${platform}.xml`) :
        `timeline_${platform}.xml`
    };
    
    // Export filtered events
    return this.export(filteredEvents, config, exportConfigWithPlatform);
  }
}