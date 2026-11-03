import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockRows: Array<{ userId: string }> = [];

vi.mock('@adaptivegate/db', () => ({
  apiKeys: { hashedKey: 'hashedKey', revokedAt: 'revokedAt', userId: 'userId' },
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockRows),
        }),
      }),
    }),
  },
}));

import { hashApiKey, verifyApiKey } from './apiKey';

describe('hashApiKey', () => {
  it('is deterministic for the same input', () => {
    expect(hashApiKey('ag_abc')).toBe(hashApiKey('ag_abc'));
  });

  it('differs for different inputs', () => {
    expect(hashApiKey('ag_abc')).not.toBe(hashApiKey('ag_xyz'));
  });
});

describe('verifyApiKey', () => {
  beforeEach(() => {
    mockRows = [];
  });

  // The revoked-key case is filtered at the SQL layer (isNull(revokedAt)),
  // so from this module's perspective a revoked key looks the same as an
  // unknown one: no matching row comes back.
  it('returns null when no active row matches', async () => {
    expect(await verifyApiKey('ag_unknown-or-revoked')).toBeNull();
  });

  it('returns the userId for a valid, active key', async () => {
    mockRows = [{ userId: 'user-1' }];
    expect(await verifyApiKey('ag_valid')).toEqual({ userId: 'user-1' });
  });
});
