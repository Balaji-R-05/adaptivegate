import { describe, expect, it } from 'vitest';
import { policySchema } from './policy';

const base = {
  id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
  userId: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c12',
  name: 'safe-coding-agent',
  version: 1,
  yaml: 'version: 1\nagent: default\nrules: []\n',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('policySchema', () => {
  it('parses a valid policy envelope', () => {
    expect(policySchema.safeParse(base).success).toBe(true);
  });

  it('rejects a non-positive version', () => {
    expect(policySchema.safeParse({ ...base, version: 0 }).success).toBe(false);
  });

  it('rejects empty yaml', () => {
    expect(policySchema.safeParse({ ...base, yaml: '' }).success).toBe(false);
  });
});
