/**
 * AAVIJA VMS — CSV Export Utility
 * ──────────────────────────────────────────────────────────────────────────────
 * Generic CSV exporter that works with any array of objects.
 * Uses papaparse (already installed) for reliable CSV generation.
 *
 * Usage:
 *   exportToCsv(visits, 'visits-2024-03-20.csv');
 *   exportToCsv(users,  'users-export.csv', ['name','email','role']);
 */

import Papa from 'papaparse';

/**
 * Export an array of objects to a CSV file downloaded in the browser.
 *
 * @param data    - Array of plain objects (e.g. from a Supabase query)
 * @param filename - Suggested filename for the download
 * @param fields  - Optional: select only specific columns (in order). If omitted, all keys are used.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  fields?: (keyof T)[]
): void {
  if (!data || data.length === 0) {
    console.warn('[exportToCsv] No data to export.');
    return;
  }

  const csv = Papa.unparse(
    (fields
      ? data.map(row =>
          Object.fromEntries(
            (fields as string[]).map(f => [f, row[f] ?? ''])
          )
        ) as unknown as T[]
      : data) as T[],
    { header: true }
  );

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamped filename for exports.
 * e.g. filenameWithDate('visits') → 'visits-2024-03-20.csv'
 */
export function filenameWithDate(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}-${date}.csv`;
}
