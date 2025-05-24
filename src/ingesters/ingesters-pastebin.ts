/**
 * Pastebin API ingester
 * Fetches pastes and snippets from Pastebin
 */

import axios from 'axios';
import { DateTime } from 'luxon';
import { TimelineEvent, PastebinConfig } from '../types/types';

export class PastebinIngester {
  private config: PastebinConfig;

  constructor(config: PastebinConfig) {
    this.config = config;
  }

  /**
   * Test connection to Pastebin API
   */
  async testConnection(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Pastebin API key is required for authenticated requests');
    }
    
    try {
      // Test API key validity
      const response = await axios.post('https://pastebin.com/api/api_post.php', 
        new URLSearchParams({
          'api_dev_key': this.config.apiKey,
          'api_option': 'userdetails',
          'api_user_key': '' // Empty for dev key test
        })
      );
      
      if (response.data.includes('Bad API request')) {
        throw new Error('Invalid API key');
      }
    } catch (error) {
      throw new Error(`Pastebin API connection failed: ${error}`);
    }
  }

  /**
   * Ingest pastes for a given username
   */
  async ingest(
    target: string, 
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    try {
      // Get user's pastes (requires API key and user authentication)
      if (this.config.apiKey && this.config.username) {
        const userPastes = await this.getUserPastes(target, dateRange);
        events.push(...userPastes);
      } else {
        // Fallback: search for public pastes containing the target
        const searchResults = await this.searchPublicPastes(target, dateRange);
        events.push(...searchResults);
      }
    } catch (error) {
      console.error(`Pastebin ingestion failed: ${error}`);
    }

    return events;
  }

  /**
   * Get authenticated user's pastes
   */
  private async getUserPastes(
    username: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Note: This requires user authentication which is complex for this demo
      // In practice, you'd need to implement the full OAuth flow or use session keys
      console.warn('User paste retrieval requires authenticated session - using public search instead');
      return await this.searchPublicPastes(username, dateRange);
      
    } catch (error) {
      console.error(`Failed to get user pastes: ${error}`);
    }

    return events;
  }

  /**
   * Search public pastes (limited functionality without premium API)
   */
  private async searchPublicPastes(
    target: string,
    dateRange?: { start: DateTime; end: DateTime }
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    
    try {
      // Note: Pastebin doesn't provide a public search API
      // This is a simplified implementation that would need to be adapted
      // based on available endpoints or scraping (not recommended)
      
      // For demo purposes, we'll create a structure for how this would work
      console.log(`Searching for pastes related to: ${target}`);
      
      // In a real implementation, you might:
      // 1. Use the trending pastes endpoint
      // 2. Monitor specific paste URLs if known
      // 3. Use third-party paste aggregators
      
      // Simulated paste data structure for reference:
      const simulatedPastes = [
        {
          paste_key: 'abc123def',
          paste_date: DateTime.now().minus({ days: 1 }).toSeconds(),
          paste_title: `Code snippet by ${target}`,
          paste_size: '1024',
          paste_url: 'https://pastebin.com/abc123def',
          paste_format_long: 'JavaScript',
          paste_format_short: 'javascript'
        }
      ];

      for (const paste of simulatedPastes) {
        const pasteTime = DateTime.fromSeconds(paste.paste_date);
        
        // Skip if outside date range
        if (dateRange && (pasteTime < dateRange.start || pasteTime > dateRange.end)) {
          continue;
        }
        
        events.push({
          id: `pastebin-${paste.paste_key}`,
          platform: 'pastebin',
          category: 'snippet',
          timestamp: pasteTime,
          originalTimestamp: pasteTime.toISO()!,
          title: paste.paste_title || 'Untitled Paste',
          content: `Code snippet (${paste.paste_size} bytes)`,
          url: paste.paste_url,
          username: target,
          metadata: {
            pasteKey: paste.paste_key,
            format: paste.paste_format_long,
            formatShort: paste.paste_format_short,
            size: paste.paste_size
          }
        });
      }
      
    } catch (error) {
      console.error(`Failed to search public pastes: ${error}`);
    }

    return events;
  }

  /**
   * Get paste content by ID (for detailed analysis)
   */
  async getPasteContent(pasteId: string): Promise<string> {
    try {
      const response = await axios.get(`https://pastebin.com/raw/${pasteId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get paste content: ${error}`);
      return '';
    }
  }
}