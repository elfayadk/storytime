import type { TimelineResult } from '../types.js';
import { serializeResult } from '../util/serialize.js';

export function toJSON(result: TimelineResult): string {
  return JSON.stringify(serializeResult(result), null, 2);
}
