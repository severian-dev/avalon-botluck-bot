/**
 * SQLite's `datetime('now')` returns 'YYYY-MM-DD HH:MM:SS' with no timezone marker.
 * JavaScript's Date parser interprets that form as *local* time, so on a non-UTC host
 * the resulting instant is wrong by the TZ offset. ISO strings with a 'Z' (what
 * Date.toISOString() emits and what we use for fields written from JS) parse correctly.
 *
 * This helper accepts either form and always returns a Date representing the intended
 * UTC instant.
 */
export function parseSqliteDate(s: string): Date {
  if (/[zZ]$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}

export function parseSqliteDateMs(s: string): number {
  return parseSqliteDate(s).getTime();
}
