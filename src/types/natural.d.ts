declare module 'natural' {
  export class WordTokenizer {
    tokenize(text: string): string[];
  }

  export class SentimentAnalyzer {
    constructor(language: string, stemmer: any, vocabulary: string);
    getSentiment(tokens: string[]): number;
  }

  export interface TfIdfTerm {
    term: string;
    tfidf: number;
  }

  export class TfIdf {
    addDocument(tokens: string[] | string): void;
    listTerms(documentIndex: number): TfIdfTerm[];
    tfidfs(term: string, callback: (i: number, measure: number) => void): void;
    tfidf(term: string, documentIndex: number): number;
  }

  export class LancasterStemmer {
    static stem(token: string): string;
    static attach(): void;
  }

  export class PorterStemmer {
    static stem(token: string): string;
    static attach(): void;
  }

  export class AggressiveTokenizer {
    tokenize(text: string): string[];
  }

  export class SentenceTokenizer {
    tokenize(text: string): string[];
  }

  export class NGrams {
    static bigrams(text: string | string[]): string[][];
    static trigrams(text: string | string[]): string[][];
    static ngrams(text: string | string[], n: number): string[][];
  }

  export class NGramsZH {
    static bigrams(text: string | string[]): string[][];
    static trigrams(text: string | string[]): string[][];
    static ngrams(text: string | string[], n: number): string[][];
  }

  export class JaroWinklerDistance {
    static compare(s1: string, s2: string): number;
    static getDistance(s1: string, s2: string): number;
  }

  export class LevenshteinDistance {
    static compare(s1: string, s2: string): number;
    static getDistance(s1: string, s2: string, options?: {
      substitutionCost?: number;
      insertionCost?: number;
      deletionCost?: number;
    }): number;
  }

  export class DiceCoefficient {
    static compare(s1: string, s2: string): number;
  }

  export class DoubleMetaphone {
    static compare(s1: string, s2: string): boolean;
    static process(text: string): string[];
  }

  export class Metaphone {
    static compare(s1: string, s2: string): boolean;
    static process(text: string): string;
  }

  export class SoundEx {
    static compare(s1: string, s2: string): boolean;
    static process(text: string): string;
  }

  export class Classifier {
    addDocument(text: string | string[], classification: string): void;
    train(): void;
    classify(text: string | string[]): string;
    getClassifications(text: string | string[]): Array<{
      label: string;
      value: number;
    }>;
  }

  export class BayesClassifier extends Classifier {
    constructor(options?: {
      classifier?: any;
      smoothing?: number;
    });
  }

  export class LogisticRegressionClassifier extends Classifier {
    constructor(options?: {
      classifier?: any;
      minIterations?: number;
    });
  }
}

declare module 'natural/lib/natural/sentiment' {
  import { SentimentAnalyzer } from 'natural';
  export = SentimentAnalyzer;
}

declare module 'natural/lib/natural/tfidf' {
  import { TfIdf } from 'natural';
  export = TfIdf;
}

declare module 'natural/lib/natural/stemmers/lancaster_stemmer' {
  import { LancasterStemmer } from 'natural';
  export = LancasterStemmer;
} 