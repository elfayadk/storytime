import { createHash } from 'node:crypto';
import type { Provenance } from './types.js';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Build a provenance envelope for a fetched response. */
export function provenance(
  connector: string,
  sourceUrl: string,
  rawResponse: string,
  licenseNote: string,
): Provenance {
  return {
    connector,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    sha256: sha256(rawResponse),
    licenseNote,
  };
}
