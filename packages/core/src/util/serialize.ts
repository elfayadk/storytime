import { DateTime } from 'luxon';
import type { SerializedEvent, TimelineEvent, TimelineResult } from '../types.js';

export function serializeEvent(e: TimelineEvent): SerializedEvent {
  return { ...e, timestamp: e.timestamp.toISO() ?? e.originalTimestamp };
}

export function deserializeEvent(e: SerializedEvent, zone = 'UTC'): TimelineEvent {
  return { ...e, timestamp: DateTime.fromISO(e.timestamp, { zone }) };
}

export interface SerializedResult extends Omit<TimelineResult, 'events' | 'embeddings'> {
  events: SerializedEvent[];
}

/** Serialize for export/storage. Embeddings are STRIPPED to keep output lean. */
export function serializeResult(r: TimelineResult): SerializedResult {
  const { embeddings, ...rest } = r;
  void embeddings;
  return { ...rest, events: r.events.map(serializeEvent) };
}
