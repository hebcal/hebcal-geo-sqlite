/**
 * Normalizes a city name for legacy lookups: lowercases and strips
 * apostrophes, spaces, and plus signs.
 * @private
 */
export function munge(s: string): string {
  return s
    .toLowerCase()
    .replaceAll("'", '')
    .replaceAll(' ', '')
    .replaceAll('+', '');
}
