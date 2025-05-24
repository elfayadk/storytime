/**
 * Natural Language Processing Pipeline
 * Handles entity extraction, sentiment analysis, and topic clustering
 */

import { TimelineEvent } from '../types/types.js';
import natural from 'natural';
import compromise from 'compromise';
import SentimentAnalyzer from 'natural/lib/natural/sentiment';
import TfIdf from 'natural/lib/natural/tfidf';
import LancasterStemmer from 'natural/lib/natural/stemmers/lancaster_stemmer';

interface CompromiseView {
  text(): string;
  honorific?: CompromiseView;
  firstName?: CompromiseView;
  lastName?: CompromiseView;
  toISO?(): string;
  out(format: string): string[];
}

interface CompromiseDoc {
  people(): CompromiseView[];
  organizations(): CompromiseView[];
  places(): CompromiseView[];
  dates(): CompromiseView[];
  urls(): CompromiseView[];
  emails(): CompromiseView[];
  hashTags(): CompromiseView[];
}

interface TfIdfTerm {
  term: string;
  tfidf: number;
}

interface NLPConfig {
  language?: string;
  stemmer?: any;
  sentiment?: string;
}

export class NLPProcessor {
  private tokenizer: natural.WordTokenizer;
  private sentimentAnalyzer: natural.SentimentAnalyzer;
  private tfidf: natural.TfIdf;
  private documentCount: number;

  constructor(config: NLPConfig = {}) {
    const {
      language = 'English',
      stemmer = natural.PorterStemmer,
      sentiment = 'afinn'
    } = config;

    this.tokenizer = new natural.WordTokenizer();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer(language, stemmer, sentiment);
    this.tfidf = new natural.TfIdf();
    this.documentCount = 0;
  }

  /**
   * Process timeline events with NLP analysis
   */
  async process(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    try {
      // Add documents to TF-IDF for topic extraction
      events.forEach(event => {
        this.tfidf.addDocument(event.content);
        this.documentCount++;
      });

      // Process each event
      return events.map(event => ({
        ...event,
        metadata: {
          ...event.metadata,
          nlp: {
            entities: this.extractEntities(event.content),
            sentiment: this.analyzeSentiment(event.content),
            topics: this.extractTopics(event.content)
          }
        }
      }));
    } catch (error) {
      console.error('Error in NLP processing:', error);
      return events;
    }
  }

  /**
   * Extract named entities from text
   */
  private extractEntities(text: string) {
    const doc = compromise(text) as CompromiseDoc;
    
    return {
      people: doc.people().map(p => p.text()),
      organizations: doc.organizations().map(o => o.text()),
      places: doc.places().map(p => p.text()),
      dates: doc.dates().map(d => d.text()),
      urls: this.extractURLs(text),
      emails: this.extractEmails(text),
      hashtags: this.extractHashtags(text)
    };
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string) {
    const tokens = this.tokenizer.tokenize(text);
    const score = this.sentimentAnalyzer.getSentiment(tokens);

    return {
      score,
      label: this.getSentimentLabel(score)
    };
  }

  /**
   * Extract topics using TF-IDF
   */
  private extractTopics(text: string): string[] {
    const tokens = this.tokenizer.tokenize(text);
    const terms = this.tfidf.listTerms(this.documentCount - 1) as TfIdfTerm[];
    
    return terms
      .filter(term => !this.isStopWord(term.term))
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, 5)
      .map(item => item.term);
  }

  /**
   * Extract URLs from text
   */
  private extractURLs(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  /**
   * Extract email addresses from text
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    return text.match(emailRegex) || [];
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    return text.match(hashtagRegex) || [];
  }

  /**
   * Get sentiment label based on score
   */
  private getSentimentLabel(score: number): string {
    if (score > 0.5) return 'very positive';
    if (score > 0) return 'positive';
    if (score === 0) return 'neutral';
    if (score > -0.5) return 'negative';
    return 'very negative';
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
      'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
      'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
      'if', 'about', 'who', 'get', 'which', 'go', 'me'
    ]);
    return stopWords.has(word.toLowerCase());
  }
} 