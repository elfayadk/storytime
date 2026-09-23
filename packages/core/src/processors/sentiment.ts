import natural from 'natural';
import type { SentimentScore } from '../types.js';

const { SentimentAnalyzer, PorterStemmer, WordTokenizer } = natural;
const tokenizer = new WordTokenizer();
const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

/** Local sentiment via `natural` (AFINN). No API, no cost. */
export function analyzeSentiment(text: string): SentimentScore {
  const clean = (text || '').trim();
  if (!clean) return { score: 0, label: 'neutral' };
  const tokens = tokenizer.tokenize(clean) ?? [];
  if (tokens.length === 0) return { score: 0, label: 'neutral' };

  const raw = analyzer.getSentiment(tokens); // roughly per-token avg
  // Clamp to [-1, 1] for a stable UI scale.
  const score = Math.max(-1, Math.min(1, raw));
  const label: SentimentScore['label'] =
    score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral';
  return { score: Number(score.toFixed(3)), label };
}
