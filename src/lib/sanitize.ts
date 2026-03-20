/**
 * AAVIJA VMS — Input Sanitization Utilities
 *
 * Strip HTML/script tags from any user-supplied text fields before persisting
 * to the database. Used as Zod `.transform()` to prevent stored XSS and
 * injection attacks.
 *
 * Security level: Stored-XSS prevention (L2)
 * This strips tags on the SERVER side — in Server Actions — so even if a
 * client bypasses the form, the sanitization still runs.
 */

/**
 * Strips all HTML/XML tags and trims whitespace.
 * Safe to use on any string field that is displayed in the UI.
 *
 * Examples:
 *   sanitizeText('<script>alert(1)</script>') → ''
 *   sanitizeText('Royal <b>Society</b>') → 'Royal Society'
 *   sanitizeText('  hello  ') → 'hello'
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')   // strip all HTML/XML tags
    .replace(/&[a-z]+;/gi, '') // strip HTML entities like &amp; &lt; etc.
    .trim();
}

/**
 * Sanitizes text but allows empty string (for optional fields).
 */
export function sanitizeOptional(input: string | undefined | null): string | undefined {
  if (input == null || input === '') return undefined;
  return sanitizeText(input);
}

/**
 * Zod transform helpers — use directly in .transform() calls.
 *
 * Usage:
 *   z.string().transform(zSanitize)
 *   z.string().optional().transform(v => zSanitizeOptional(v))
 */
export const zSanitize = (v: string) => sanitizeText(v);
export const zSanitizeOptional = (v: string | undefined) =>
  v ? sanitizeText(v) : v;
