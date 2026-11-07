import { describe, expect, it } from 'vitest';
import { eventSchema } from './event';

const base = {
  id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
  userId: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c12',
  type: 'tool_call' as const,
  payload: { tool: 'github.create_issue' },
  hash: 'deadbeef',
  previousHash: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('eventSchema', () => {
  it('parses a valid event', () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an unknown event type', () => {
    expect(eventSchema.safeParse({ ...base, type: 'not_a_type' }).success).toBe(false);
  });
});
