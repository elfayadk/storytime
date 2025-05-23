/**
 * NLP Processing Module
 * Provides entity extraction, sentiment analysis, and topic modeling
 */

import { TimelineEvent, Entity, EntityType, SentimentScore, NLPConfig } from '../types.js';

export class NLPProcessor {
  private config: NLPConfig;

  constructor(config: NLPConfig = {}) {
    this.config = {
      languageDetection: { enabled: true, minConfidence: 0.7, ...config.languageDetection },
      entityExtraction: { enabled: true, minConfidence: 0.6, ...config.entityExtraction },
      sentimentAnalysis: { enabled: true, model: 'basic', ...config.sentimentAnalysis },
      topicModeling: { enabled: true, numTopics: 5, minRelevance: 0.3, ...config.topicModeling },
      keywordExtraction: { enabled: true, maxKeywords: 10, minRelevance: 0.5, ...config.keywordExtraction }
    };
  }

  /**
   * Process a batch of timeline events with NLP enrichment
   */
  async processEvents(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    const enrichedEvents: TimelineEvent[] = [];

    for (const event of events) {
      const enrichedEvent = { ...event };
      
      // Skip events with empty content
      if (!event.content || event.content.trim().length === 0) {
        enrichedEvents.push(enrichedEvent);
        continue;
      }

      // Apply language detection if enabled
      if (this.config.languageDetection?.enabled) {
        enrichedEvent.language = await this.detectLanguage(event.content);
      }

      // Apply entity extraction if enabled
      if (this.config.entityExtraction?.enabled) {
        enrichedEvent.entities = await this.extractEntities(event.content);
      }

      // Apply sentiment analysis if enabled
      if (this.config.sentimentAnalysis?.enabled) {
        enrichedEvent.sentiment = await this.analyzeSentiment(event.content);
      }

      // Apply topic modeling if enabled
      if (this.config.topicModeling?.enabled) {
        enrichedEvent.topics = await this.modelTopics(event.content);
      }

      enrichedEvents.push(enrichedEvent);
    }

    return enrichedEvents;
  }

  /**
   * Detect language of content
   */
  private async detectLanguage(text: string): Promise<string> {
    // Basic language detection implementation
    // Language detection libraries like 'franc' or 'language-detect' could be used here
    
    // For now, implement a simple heuristic approach based on character analysis
    // Default to English for the basic implementation
    const characters = text.toLowerCase();
    
    // Simple detection based on common language markers
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(characters)) {
      return 'ja'; // Japanese
    } else if (/[\u0400-\u04FF]/.test(characters)) {
      return 'ru'; // Russian
    } else if (/[\u4E00-\u9FFF]/.test(characters)) {
      return 'zh'; // Chinese
    } else if (/[\u0600-\u06FF]/.test(characters)) {
      return 'ar'; // Arabic
    } else if (/[áéíóúüñ]/.test(characters)) {
      return 'es'; // Possibly Spanish
    } else if (/[àèéêëïîôùç]/.test(characters)) {
      return 'fr'; // Possibly French
    } else if (/[äöüß]/.test(characters)) {
      return 'de'; // Possibly German
    }
    
    return 'en'; // Default to English
  }

  /**
   * Extract named entities from content
   */
  private async extractEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    const minConfidence = this.config.entityExtraction?.minConfidence || 0.6;
    
    // Extract people (names with capital letters)
    const nameRegex = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
    const nameMatches = [...text.matchAll(nameRegex)];
    for (const match of nameMatches) {
      if (this.validateEntityCandidate(match[0])) {
        entities.push({
          text: match[0],
          type: 'person',
          confidence: 0.7,
        });
      }
    }
    
    // Extract organizations (names with all caps or capital words with Inc, Corp, etc.)
    const orgRegex = /\b([A-Z][a-zA-Z]*([ ]?(Inc|Corp|LLC|Company|Technologies|Systems|Group|Foundation))?)\b/g;
    const orgMatches = [...text.matchAll(orgRegex)];
    for (const match of orgMatches) {
      if (this.validateEntityCandidate(match[0])) {
        entities.push({
          text: match[0],
          type: 'organization',
          confidence: 0.65,
        });
      }
    }
    
    // Extract URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatches = [...text.matchAll(urlRegex)];
    for (const match of urlMatches) {
      entities.push({
        text: match[0],
        type: 'url',
        confidence: 0.95,
      });
    }
    
    // Extract email addresses
    const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    const emailMatches = [...text.matchAll(emailRegex)];
    for (const match of emailMatches) {
      entities.push({
        text: match[0],
        type: 'email',
        confidence: 0.9,
      });
    }
    
    // Extract hashtags
    const hashtagRegex = /\B(#[a-zA-Z0-9_]+)\b/g;
    const hashtagMatches = [...text.matchAll(hashtagRegex)];
    for (const match of hashtagMatches) {
      entities.push({
        text: match[0],
        type: 'hashtag',
        confidence: 0.95,
      });
    }
    
    // Extract mentions
    const mentionRegex = /\B(@[a-zA-Z0-9_]+)\b/g;
    const mentionMatches = [...text.matchAll(mentionRegex)];
    for (const match of mentionMatches) {
      entities.push({
        text: match[0],
        type: 'mention',
        confidence: 0.95,
      });
    }
    
    // Filter out entities below confidence threshold
    return entities.filter(entity => entity.confidence >= minConfidence);
  }

  /**
   * Validate entity candidate to reduce false positives
   */
  private validateEntityCandidate(text: string): boolean {
    // Ignore common false positives
    const commonWords = [
      'The', 'This', 'That', 'These', 'Those',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (commonWords.includes(text)) {
      return false;
    }
    
    // Require minimum length
    if (text.length < 3) {
      return false;
    }
    
    return true;
  }

  /**
   * Analyze sentiment of content
   */
  private async analyzeSentiment(text: string): Promise<SentimentScore> {
    // Basic sentiment analysis implementation
    // Real implementation would use a library like 'sentiment', 'natural', or an API
    
    // Define positive and negative word lists
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 
                          'like', 'love', 'happy', 'glad', 'positive', 'nice', 'beautiful', 'perfect',
                          'best', 'better', 'improved', 'impressive', 'thank', 'thanks', 'appreciated',
                          'exciting', 'excited', 'win', 'winning', 'success', 'successful'];
    
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'poor', 'negative',
                          'hate', 'dislike', 'sad', 'unhappy', 'angry', 'annoyed', 'disappointed',
                          'fail', 'failed', 'failure', 'problem', 'issue', 'bug', 'error', 'wrong',
                          'broken', 'useless', 'difficult', 'hard', 'confusing', 'frustrated'];
    
    // Tokenize text into words
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    
    // Count positive and negative words
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) {
        positiveCount++;
      } else if (negativeWords.includes(word)) {
        negativeCount++;
      }
    }
    
    // Calculate sentiment score (-1.0 to 1.0)
    const totalWords = words.length;
    const score = totalWords > 0 
      ? (positiveCount - negativeCount) / Math.min(totalWords, positiveCount + negativeCount + 5)
      : 0;
    
    // Calculate magnitude (intensity) based on number of sentiment words
    const magnitude = (positiveCount + negativeCount) / Math.max(1, totalWords) * 5;
    
    // Determine label
    let label: 'positive' | 'negative' | 'neutral';
    if (score > 0.1) {
      label = 'positive';
    } else if (score < -0.1) {
      label = 'negative';
    } else {
      label = 'neutral';
    }
    
    return {
      score: Math.max(-1, Math.min(1, score)), // Clamp between -1 and 1
      magnitude,
      label
    };
  }

  /**
   * Extract topics from content
   */
  private async modelTopics(text: string): Promise<string[]> {
    // Simple topic extraction based on keyword frequency
    // Real implementation might use TF-IDF, LDA, or more sophisticated techniques
    
    // Tokenize and normalize text
    const tokens = text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split on whitespace
      .filter(word => word.length > 3) // Remove short words
      .filter(word => !this.isStopWord(word)); // Remove stop words
    
    // Count word frequencies
    const wordCounts = new Map<string, number>();
    for (const token of tokens) {
      wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
    }
    
    // Sort by frequency
    const sortedWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.topicModeling?.numTopics || 5)
      .map(entry => entry[0]);
    
    return sortedWords;
  }
  
  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
      'his', 'from', 'they', 'she', 'will', 'would', 'there', 'their', 'what',
      'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take',
      'into', 'year', 'your', 'some', 'could', 'them', 'see', 'other', 'than',
      'then', 'now', 'look', 'only', 'come', 'over', 'think', 'also', 'back',
      'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way'
    ];
    return stopWords.includes(word);
  }
}