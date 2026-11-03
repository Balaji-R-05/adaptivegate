import { describe, expect, it } from 'vitest';
import { apiKeySchema } from './apiKey';

const base = {
  id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
  userId: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c12',
  hashedKey: 'sha256:deadbeef',
  label: 'laptop',
  createdAt: '2026-01-01T00:00:00.000Z',
  revokedAt: null,
};

describe('apiKeySchema', () => {
  it('parses an active key', () => {
    expect(apiKeySchema.safeParse(base).success).toBe(true);
  });

  it('parses a revoked key', () => {
    expect(apiKeySchema.safeParse({ ...base, revokedAt: '2026-02-01T00:00:00.000Z' }).success).toBe(
      true,
    );
  });

  it('rejects an empty label', () => {
    expect(apiKeySchema.safeParse({ ...base, label: '' }).success).toBe(false);
  });
});
