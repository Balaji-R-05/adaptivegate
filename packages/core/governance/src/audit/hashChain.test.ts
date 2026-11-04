import { describe, expect, it } from 'vitest';
import { computeEventHash, verifyChain, type ChainedAuditEvent } from './hashChain';

const baseEntry = {
  userId: 'user-1',
  type: 'tool_call',
  payload: { tool: 'echo' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('computeEventHash', () => {
  it('is deterministic for the same input', () => {
    expect(computeEventHash(null, baseEntry)).toBe(computeEventHash(null, baseEntry));
  });

  it('differs when the previous hash differs', () => {
    expect(computeEventHash(null, baseEntry)).not.toBe(computeEventHash('some-hash', baseEntry));
  });

  it('differs when the payload differs', () => {
    const hashA = computeEventHash(null, baseEntry);
    const hashB = computeEventHash(null, { ...baseEntry, payload: { tool: 'other' } });
    expect(hashA).not.toBe(hashB);
  });

  // Regression test for a real bug: Postgres's jsonb column type reorders
  // object keys internally, so a payload read back after storage has
  // different key order than when it was written — a naive JSON.stringify
  // would make the hash fail to verify its own untampered data purely from
  // that round trip. See canonicalJson.ts.
  it('is the same regardless of payload key order', () => {
    const insertionOrder = computeEventHash(null, {
      ...baseEntry,
      payload: { tool: 'echo', serverId: 's1', blocked: true },
    });
    const jsonbRoundTripOrder = computeEventHash(null, {
      ...baseEntry,
      payload: { blocked: true, tool: 'echo', serverId: 's1' },
    });
    expect(insertionOrder).toBe(jsonbRoundTripOrder);
  });
});

describe('verifyChain', () => {
  function buildChain(): ChainedAuditEvent[] {
    const first = { ...baseEntry, previousHash: null };
    const firstHash = computeEventHash(null, first);
    const second = { ...baseEntry, payload: { tool: 'other' }, previousHash: firstHash };
    const secondHash = computeEventHash(firstHash, second);
    return [
      { ...first, hash: firstHash },
      { ...second, hash: secondHash },
    ];
  }

  it('returns true for an untampered chain', () => {
    expect(verifyChain(buildChain())).toBe(true);
  });

  it('returns false if an event payload was tampered with after the fact', () => {
    const chain = buildChain();
    const tampered = chain.map((event, index) =>
      index === 0 ? { ...event, payload: { tool: 'tampered' } } : event,
    );
    expect(verifyChain(tampered)).toBe(false);
  });
});
