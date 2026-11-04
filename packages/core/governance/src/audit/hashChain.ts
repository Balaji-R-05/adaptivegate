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

// Recomputes each event's hash from its own fields and compares — if
// anything in a stored row was altered after the fact, this returns false.
export function verifyChain(events: ChainedAuditEvent[]): boolean {
  return events.every((event) => computeEventHash(event.previousHash, event) === event.hash);
}
