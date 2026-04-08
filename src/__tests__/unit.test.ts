/**
 * AAVIJA VMS — Unit Tests
 * Tests for critical utilities and logic that can be tested without DB/network.
 *
 * Run: npm test
 * Or:  npx vitest run
 */

import { describe, it, expect, vi } from 'vitest';
import { sanitizeText, sanitizeOptional, zSanitize, zSanitizeOptional } from '../lib/sanitize';

// ─── sanitize.ts ─────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    // Tags are removed; inner text content is preserved (harmless without markup)
    expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeText('<b>hello</b>')).toBe('hello');
    // Self-closing tags with attributes are stripped completely
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips HTML entities', () => {
    // &amp; entity is stripped, leaving surrounding words
    expect(sanitizeText('Hello &amp; World')).toBe('Hello  World');
    // &lt;script&gt; — entities stripped, leaving inner word 'script'
    expect(sanitizeText('&lt;script&gt;')).toBe('script');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
    expect(sanitizeText('\n\thello\n')).toBe('hello');
  });

  it('passes through safe text unchanged (after trim)', () => {
    expect(sanitizeText('Royal Society Building')).toBe('Royal Society Building');
    expect(sanitizeText('123 Main Street, Floor 4')).toBe('123 Main Street, Floor 4');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });
});

describe('sanitizeOptional', () => {
  it('returns undefined for null/undefined/empty', () => {
    expect(sanitizeOptional(null)).toBeUndefined();
    expect(sanitizeOptional(undefined)).toBeUndefined();
    expect(sanitizeOptional('')).toBeUndefined();
  });

  it('sanitizes non-empty strings', () => {
    expect(sanitizeOptional('<b>test</b>')).toBe('test');
    expect(sanitizeOptional('  hello  ')).toBe('hello');
  });
});

describe('zSanitize / zSanitizeOptional (Zod transforms)', () => {
  it('zSanitize strips tags', () => {
    expect(zSanitize('<h1>title</h1>')).toBe('title');
  });

  it('zSanitizeOptional returns original if empty/undefined', () => {
    expect(zSanitizeOptional(undefined)).toBeUndefined();
    expect(zSanitizeOptional('safe text')).toBe('safe text');
  });
});

// ─── with-timing.ts ──────────────────────────────────────────────────────────

import { withTiming } from '../lib/with-timing';

describe('withTiming', () => {
  it('returns the result of the wrapped function', async () => {
    const result = await withTiming('test_action', async () => 42);
    expect(result).toBe(42);
  });

  it('re-throws errors from the wrapped function', async () => {
    await expect(
      withTiming('failing_action', async () => { throw new Error('oops'); })
    ).rejects.toThrow('oops');
  });

  it('accepts context without throwing', async () => {
    const result = await withTiming('ctx_action', async () => 'ok', {
      context: { user_id: 'abc', page: 'test' },
      slowThresholdMs: 99999,
    });
    expect(result).toBe('ok');
  });
});

// ─── Optimistic Locking Logic ─────────────────────────────────────────────────

describe('Optimistic locking conflict detection', () => {
  /**
   * Pure logic test: if DB updated_at !== expectedUpdatedAt we should return conflict.
   * This tests the LOGIC without calling the DB.
   */
  function checkConflict(dbUpdatedAt: string, expectedUpdatedAt: string) {
    if (dbUpdatedAt !== expectedUpdatedAt) {
      return { conflict: true, error: 'Row was modified by someone else.' };
    }
    return null;
  }

  it('returns conflict when timestamps differ', () => {
    const result = checkConflict('2024-01-02T00:00:00Z', '2024-01-01T00:00:00Z');
    expect(result?.conflict).toBe(true);
  });

  it('returns null when timestamps match', () => {
    const ts = '2024-01-01T12:00:00Z';
    expect(checkConflict(ts, ts)).toBeNull();
  });
});

// ─── Pagination Range ─────────────────────────────────────────────────────────

import { paginationRange } from '../types/database.types';

describe('paginationRange', () => {
  it('computes correct from/to for page 0 size 25', () => {
    const { from, to } = paginationRange(0, 25);
    expect(from).toBe(0);
    expect(to).toBe(24);
  });

  it('computes correct from/to for page 1 size 25', () => {
    const { from, to } = paginationRange(1, 25);
    expect(from).toBe(25);
    expect(to).toBe(49);
  });

  it('computes correctly for page 2 size 10', () => {
    const { from, to } = paginationRange(2, 10);
    expect(from).toBe(20);
    expect(to).toBe(29);
  });
});
