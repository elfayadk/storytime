import type { TimelineResult } from '../types.js';
import { toJSON } from './json.js';
import { toCSV } from './csv.js';
import { toMarkdown } from './markdown.js';
import { toXML } from './xml.js';
import { toHTML } from './html.js';
import { toDossier } from './dossier.js';

export type ExportFormat = 'json' | 'csv' | 'md' | 'markdown' | 'xml' | 'html' | 'dossier';

export const EXPORT_EXT: Record<string, string> = {
  json: 'json',
  csv: 'csv',
  md: 'md',
  markdown: 'md',
  xml: 'xml',
  html: 'html',
  dossier: 'html',
};

export function exportTimeline(result: TimelineResult, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return toJSON(result);
    case 'csv':
      return toCSV(result);
    case 'md':
    case 'markdown':
      return toMarkdown(result);
    case 'xml':
      return toXML(result);
    case 'html':
      return toHTML(result);
    case 'dossier':
      return toDossier(result);
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

export { toJSON, toCSV, toMarkdown, toXML, toHTML, toDossier };
