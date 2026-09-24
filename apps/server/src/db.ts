import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { SerializedResult } from '@storytime/core';

/**
 * SQLite persistence (embedded, zero-infra, free) - replaces the old
 * MongoDB + Postgres double stack. Stores timelines plus a per-event vector
 * store for semantic search. For timeline scale (hundreds of vectors), KNN is
 * done in-process with cosine similarity; the schema is sqlite-vec-ready if a
 * future build needs million-scale ANN.
 */
export interface StoredTimeline {
  id: string;
  target: string;
  created_at: string;
  event_count: number;
  embedding_provider: string | null;
  embedding_dim: number | null;
  data: SerializedResult;
}

export class Store {
  private db: Database.Database;

  constructor(path = process.env.STORYTIME_DB || './data/storytime.db') {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timelines (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        created_at TEXT NOT NULL,
        event_count INTEGER NOT NULL,
        embedding_provider TEXT,
        embedding_dim INTEGER,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timelines_target ON timelines(target);
      CREATE INDEX IF NOT EXISTS idx_timelines_created ON timelines(created_at);
      CREATE TABLE IF NOT EXISTS event_vectors (
        timeline_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        dim INTEGER NOT NULL,
        vec BLOB NOT NULL,
        PRIMARY KEY (timeline_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_vectors_timeline ON event_vectors(timeline_id);
    `);
    // Full-text keyword index (BM25). unicode61 + remove_diacritics works for Arabic too.
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
          event_id UNINDEXED, timeline_id UNINDEXED, title, content,
          tokenize='unicode61 remove_diacritics 2'
        );`);
      this.fts = true;
    } catch {
      this.fts = false;
    }
  }

  private fts = false;

  save(
    result: SerializedResult,
    embeddings?: Record<string, number[]>,
    provider?: string,
    dim?: number,
  ): StoredTimeline {
    const id = `${result.target.replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}`;
    this.db
      .prepare(
        `INSERT INTO timelines (id, target, created_at, event_count, embedding_provider, embedding_dim, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        result.target,
        result.generatedAt,
        result.events.length,
        provider ?? null,
        dim ?? null,
        JSON.stringify(result),
      );

    if (embeddings && Object.keys(embeddings).length) {
      const ins = this.db.prepare(
        'INSERT OR REPLACE INTO event_vectors (timeline_id, event_id, dim, vec) VALUES (?, ?, ?, ?)',
      );
      const tx = this.db.transaction((rows: [string, number[]][]) => {
        for (const [eventId, v] of rows) {
          ins.run(id, eventId, v.length, Buffer.from(Float32Array.from(v).buffer));
        }
      });
      tx(Object.entries(embeddings));
    }

    if (this.fts) {
      const insFts = this.db.prepare(
        'INSERT INTO events_fts (event_id, timeline_id, title, content) VALUES (?, ?, ?, ?)',
      );
      const tx = this.db.transaction(() => {
        for (const e of result.events) insFts.run(e.id, id, e.title ?? '', e.content ?? '');
      });
      tx();
    }

    return {
      id,
      target: result.target,
      created_at: result.generatedAt,
      event_count: result.events.length,
      embedding_provider: provider ?? null,
      embedding_dim: dim ?? null,
      data: result,
    };
  }

  list(limit = 50): Omit<StoredTimeline, 'data'>[] {
    return this.db
      .prepare(
        `SELECT id, target, created_at, event_count, embedding_provider, embedding_dim
         FROM timelines ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as Omit<StoredTimeline, 'data'>[];
  }

  get(id: string): StoredTimeline | null {
    const row = this.db
      .prepare(
        `SELECT id, target, created_at, event_count, embedding_provider, embedding_dim, data
         FROM timelines WHERE id = ?`,
      )
      .get(id) as (Omit<StoredTimeline, 'data'> & { data: string }) | undefined;
    if (!row) return null;
    return { ...row, data: JSON.parse(row.data) as SerializedResult };
  }

  /** Load all event vectors for a timeline. */
  getVectors(timelineId: string): { eventId: string; vec: Float32Array }[] {
    const rows = this.db
      .prepare('SELECT event_id, vec FROM event_vectors WHERE timeline_id = ?')
      .all(timelineId) as { event_id: string; vec: Buffer }[];
    return rows.map((r) => ({
      eventId: r.event_id,
      vec: new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4),
    }));
  }

  /** BM25 keyword search over a timeline's events. Returns ranked event ids. */
  ftsSearch(timelineId: string, query: string, limit = 50): string[] {
    if (!this.fts) return [];
    const match = query
      .split(/\s+/)
      .map((t) => t.replace(/["^*():]/g, '').trim())
      .filter(Boolean)
      .map((t) => `"${t}"`)
      .join(' OR ');
    if (!match) return [];
    try {
      const rows = this.db
        .prepare(
          `SELECT event_id FROM events_fts WHERE events_fts MATCH ? AND timeline_id = ?
           ORDER BY bm25(events_fts) LIMIT ?`,
        )
        .all(match, timelineId, limit) as { event_id: string }[];
      return rows.map((r) => r.event_id);
    } catch {
      return [];
    }
  }

  delete(id: string): boolean {
    this.db.prepare('DELETE FROM event_vectors WHERE timeline_id = ?').run(id);
    if (this.fts) this.db.prepare('DELETE FROM events_fts WHERE timeline_id = ?').run(id);
    return this.db.prepare('DELETE FROM timelines WHERE id = ?').run(id).changes > 0;
  }
}
