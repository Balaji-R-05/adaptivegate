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

  it('reports valid for an untampered chain', () => {
    expect(verifyChain(buildChain())).toEqual({
      valid: true,
      totalEvents: 2,
      brokenCount: 0,
      firstBrokenIndex: null,
    });
  });

  it('reports the index of a tampered event, not just that something broke', () => {
    const chain = buildChain();
    const tampered = chain.map((event, index) =>
      index === 0 ? { ...event, payload: { tool: 'tampered' } } : event,
    );
    expect(verifyChain(tampered)).toEqual({
      valid: false,
      totalEvents: 2,
      brokenCount: 1,
      firstBrokenIndex: 0,
    });
  });

  it('counts every broken event, not just the first', () => {
    const chain = buildChain();
    const bothTampered = chain.map((event) => ({ ...event, payload: { tool: 'tampered' } }));
    const result = verifyChain(bothTampered);
    expect(result.valid).toBe(false);
    expect(result.brokenCount).toBe(2);
    expect(result.firstBrokenIndex).toBe(0);
  });

  it('distinguishes "a few old events are broken" from "everything is broken"', () => {
    // Regression case for the real scenario this was built for: a handful
    // of events written before a hashing fix stay permanently unverifiable
    // (append-only — never rewritten), while everything since verifies
    // fine. A flat boolean can't tell this apart from total corruption.
    const chain = buildChain();
    const onlyFirstTampered = chain.map((event, index) =>
      index === 0 ? { ...event, payload: { tool: 'tampered' } } : event,
    );
    const result = verifyChain(onlyFirstTampered);
    expect(result.brokenCount).toBe(1);
    expect(result.totalEvents).toBe(2);
  });
});
