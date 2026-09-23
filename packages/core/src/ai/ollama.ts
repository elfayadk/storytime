import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { TimelineEvent, TimelineStats } from '../types.js';

/**
 * Optional local LLM via Ollama (https://ollama.com) - free & open-source,
 * runs entirely on the user's machine. Disabled unless config.ai.enabled.
 * Every method fails soft: if Ollama isn't running, the classic NLP pipeline
 * output stands unchanged.
 */
export class OllamaClient {
  constructor(
    private config: StorytimeConfig,
    private logger: Logger,
  ) {}

  get enabled(): boolean {
    return this.config.ai.enabled;
  }

  async available(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch(`${this.config.ai.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async generate(prompt: string, maxChars = 1200): Promise<string | null> {
    try {
      const res = await fetch(`${this.config.ai.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.ai.model,
          prompt,
          stream: false,
          options: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { response?: string };
      return (data.response ?? '').trim().slice(0, maxChars) || null;
    } catch (err) {
      this.logger.debug(`ollama: ${(err as Error).message}`);
      return null;
    }
  }

  /** One-line summary for a single event. */
  async summarizeEvent(event: TimelineEvent): Promise<string | null> {
    const text = `${event.title}\n${event.content}`.slice(0, 1500);
    if (!text.trim()) return null;
    return this.generate(
      `Summarize this ${event.platform} activity in one concise sentence. ` +
        `No preamble, just the sentence.\n\n${text}`,
      200,
    );
  }

  /**
   * Grounded RAG answer: given a question and the most relevant events, answer
   * using ONLY those events, with inline [n] citations. Fully local.
   */
  async answer(
    question: string,
    context: { title: string; content: string; platform: string; timestamp: string }[],
  ): Promise<string | null> {
    if (context.length === 0) return null;
    const numbered = context
      .map((c, i) => `[${i + 1}] (${c.platform}, ${c.timestamp}) ${c.title}\n${c.content}`.slice(0, 600))
      .join('\n\n');
    return this.generate(
      `Answer the question using ONLY the numbered timeline events below. Cite the ` +
        `events you use with their [number]. If the events don't answer it, say so.\n\n` +
        `Events:\n${numbered}\n\nQuestion: ${question}\n\nAnswer:`,
      1500,
    );
  }

  /** Narrative over the whole timeline. */
  async narrate(
    target: string,
    events: TimelineEvent[],
    stats: TimelineStats,
  ): Promise<string | null> {
    if (events.length === 0) return null;
    const sample = events
      .slice(0, 40)
      .map((e) => `- [${e.timestamp.toISODate()}] (${e.platform}) ${e.title}`)
      .join('\n');
    const platforms = Object.keys(stats.byPlatform).join(', ');
    return this.generate(
      `You are analyzing the public activity timeline of "${target}" across ${platforms}. ` +
        `There are ${stats.totalEvents} events. Write a neutral 3-4 sentence narrative summary ` +
        `of what this person/entity has been doing and any notable themes. ` +
        `Base it only on the events below.\n\n${sample}`,
      1500,
    );
  }
}
