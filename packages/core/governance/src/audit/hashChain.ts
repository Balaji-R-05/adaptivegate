import { createHash } from 'node:crypto';
import { canonicalStringify } from './canonicalJson';

export interface AuditEventInput {
  userId: string;
  type: string;
  payload: unknown;
  // ISO string — must be stable/already-fixed before hashing, not generated
  // again at verify time, or every verification would fail.
  createdAt: string;
}

export function computeEventHash(previousHash: string | null, entry: AuditEventInput): string {
  const canonical = canonicalStringify({
    previousHash,
    userId: entry.userId,
    type: entry.type,
    payload: entry.payload,
    createdAt: entry.createdAt,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export interface ChainedAuditEvent extends AuditEventInput {
  hash: string;
  previousHash: string | null;
}

export interface VerifyChainResult {
  valid: boolean;
  totalEvents: number;
  // How many individual events have a hash mismatch — a chain can have more
  // than one, e.g. a batch of events written before a hashing bug fix.
  brokenCount: number;
  // Index (0-based, oldest-first — same order `events` was passed in) of
  // the first mismatch, or null if the chain is fully valid. A single
  // boolean can't distinguish "every event is broken" from "a handful of
  // old events are, everything since is fine" — this lets a caller tell
  // the difference instead of reporting a flat, all-or-nothing failure.
  firstBrokenIndex: number | null;
}

// Recomputes each event's hash from its own fields and compares — if
// anything in a stored row was altered after the fact, the corresponding
// entry's hash won't match.
export function verifyChain(events: ChainedAuditEvent[]): VerifyChainResult {
  let brokenCount = 0;
  let firstBrokenIndex: number | null = null;

  events.forEach((event, index) => {
    const matches = computeEventHash(event.previousHash, event) === event.hash;
    if (!matches) {
      brokenCount += 1;
      if (firstBrokenIndex === null) firstBrokenIndex = index;
    }
  });

  return { valid: brokenCount === 0, totalEvents: events.length, brokenCount, firstBrokenIndex };
}
