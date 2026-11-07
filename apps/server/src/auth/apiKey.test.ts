import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockRow {
  userId: string;
  identityId?: string | null;
  serverScope?: string[] | null;
  budgetLimit?: number | null;
  policyId?: string | null;
  enabled?: boolean | null;
}

let mockRows: MockRow[] = [];

vi.mock('@adaptivegate/db', () => ({
  apiKeys: { hashedKey: 'hashedKey', revokedAt: 'revokedAt', userId: 'userId', identityId: 'identityId' },
  identities: { id: 'id', serverScope: 'serverScope', budgetLimit: 'budgetLimit', policyId: 'policyId', enabled: 'enabled' },
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(mockRows),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  isNull: (...args: unknown[]) => args,
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

  it('returns just the userId for a plain, unrestricted key', async () => {
    mockRows = [{ userId: 'user-1', identityId: null }];
    expect(await verifyApiKey('ag_valid')).toEqual({ userId: 'user-1' });
  });

  it('returns the identity scope/budget for a scoped key', async () => {
    mockRows = [
      {
        userId: 'user-1',
        identityId: 'identity-1',
        serverScope: ['server-1'],
        budgetLimit: 50,
        policyId: 'policy-1',
        enabled: true,
      },
    ];
    expect(await verifyApiKey('ag_scoped')).toEqual({
      userId: 'user-1',
      identity: {
        id: 'identity-1',
        serverScope: ['server-1'],
        budgetLimit: 50,
        policyId: 'policy-1',
        enabled: true,
      },
    });
  });
});
