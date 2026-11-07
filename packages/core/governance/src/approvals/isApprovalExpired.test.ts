import { describe, expect, it } from 'vitest';
import { isApprovalExpired } from './isApprovalExpired';

describe('isApprovalExpired', () => {
  it('is not expired while before the expiry time (benign case)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expiresAt = new Date('2026-01-01T00:15:00Z');
    expect(isApprovalExpired(expiresAt, now)).toBe(false);
  });

  it('is expired exactly at the expiry time (blocked case)', () => {
    const at = new Date('2026-01-01T00:15:00Z');
    expect(isApprovalExpired(at, at)).toBe(true);
  });

  it('is expired after the expiry time (blocked case)', () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const expiresAt = new Date('2026-01-01T00:15:00Z');
    expect(isApprovalExpired(expiresAt, now)).toBe(true);
  });
});
