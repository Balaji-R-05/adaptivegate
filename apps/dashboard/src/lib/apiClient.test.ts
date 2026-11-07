import { describe, expect, it, vi } from 'vitest';

// apiClient.ts imports ./supabase at module scope, which throws if the
// VITE_SUPABASE_* env vars aren't set — irrelevant to reviveDates itself
// (a pure function), but still loaded transitively, so mock it the same
// way every page test does.
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

const { reviveDates } = await import('./apiClient');

describe('reviveDates (JSON.parse reviver)', () => {
  it('converts an ISO 8601 timestamp with milliseconds and Z into a real Date', () => {
    const json = '{"createdAt":"2026-11-08T03:12:45.123Z"}';
    const parsed = JSON.parse(json, reviveDates) as { createdAt: unknown };
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect((parsed.createdAt as Date).toISOString()).toBe('2026-11-08T03:12:45.123Z');
  });

  it('converts nested and array-nested timestamps too (JSON.parse applies the reviver recursively)', () => {
    const json = JSON.stringify([
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', nested: { decidedAt: '2026-02-02T00:00:00.000Z' } },
    ]);
    const parsed = JSON.parse(json, reviveDates) as Array<{
      createdAt: unknown;
      nested: { decidedAt: unknown };
    }>;
    expect(parsed[0]?.createdAt).toBeInstanceOf(Date);
    expect(parsed[0]?.nested.decidedAt).toBeInstanceOf(Date);
  });

  it('leaves null, non-date strings, and plain values alone', () => {
    const json = '{"decidedAt":null,"name":"safe-coding-agent","version":1,"tool":"microsoft_docs_search"}';
    const parsed = JSON.parse(json, reviveDates) as Record<string, unknown>;
    expect(parsed.decidedAt).toBeNull();
    expect(parsed.name).toBe('safe-coding-agent');
    expect(parsed.version).toBe(1);
  });

  it('does not false-positive on a string that merely contains a date-shaped substring', () => {
    const json = JSON.stringify({ yaml: 'created around 2026-11-08T03:12:45.123Z in a comment, not a field' });
    const parsed = JSON.parse(json, reviveDates) as { yaml: unknown };
    expect(typeof parsed.yaml).toBe('string');
  });

  it('does not match a bare date (no time component), which this app never sends', () => {
    const json = '{"d":"2026-11-08"}';
    const parsed = JSON.parse(json, reviveDates) as { d: unknown };
    expect(typeof parsed.d).toBe('string');
  });
});
