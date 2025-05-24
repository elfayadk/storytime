import type { TimelineEvent } from '../types';

export const exportToCSV = (events: TimelineEvent[]): string => {
  const headers = [
    'Date',
    'Title',
    'Description',
    'Platform',
    'Category',
    'User',
    'Sentiment',
    'Topics'
  ];

  const rows = events.map(event => [
    new Date(event.timestamp).toISOString(),
    event.title,
    event.description,
    event.platform,
    event.category,
    event.user.name,
    event.sentiment?.label || 'neutral',
    (event.topics || []).join(', ')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
};

export const exportToJSON = (events: TimelineEvent[]): string => {
  return JSON.stringify(events, null, 2);
};

export const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTimeline = (events: TimelineEvent[], format: 'csv' | 'json' = 'csv') => {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `timeline-export-${timestamp}`;

  if (format === 'csv') {
    const csvContent = exportToCSV(events);
    downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  } else {
    const jsonContent = exportToJSON(events);
    downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }
}; 