type Cell = string | number | boolean | null | undefined;

/** Quote a value for CSV and neutralise spreadsheet formula injection. */
function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@|\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV in the browser and trigger a download. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
