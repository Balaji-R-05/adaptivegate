import { describe, expect, it } from 'vitest';
import { userSchema } from './user';

describe('userSchema', () => {
  it('parses a valid user', () => {
    const result = userSchema.safeParse({
      id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
      email: 'dev@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = userSchema.safeParse({
      id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
      email: 'not-an-email',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
