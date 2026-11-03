import { describe, expect, it } from 'vitest';
import { createServerConfigInputSchema, serverConfigSchema } from './serverConfig';

const base = {
  id: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c11',
  userId: '3b0f3c8a-5b1e-4b8b-9f9e-7a6f9b3a2c12',
  name: 'github',
  url: 'https://example.com/github-mcp',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('serverConfigSchema', () => {
  it('parses a bearer-auth server', () => {
    const result = serverConfigSchema.safeParse({
      ...base,
      auth: { type: 'bearer', tokenEnv: 'GITHUB_MCP_TOKEN' },
    });
    expect(result.success).toBe(true);
  });

  it('parses a no-auth server and defaults enabledTools to []', () => {
    const result = serverConfigSchema.safeParse({ ...base, auth: { type: 'none' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledTools).toEqual([]);
    }
  });

  it('rejects a bearer auth missing tokenEnv', () => {
    const result = serverConfigSchema.safeParse({ ...base, auth: { type: 'bearer' } });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL', () => {
    const result = serverConfigSchema.safeParse({
      ...base,
      url: 'not-a-url',
      auth: { type: 'none' },
    });
    expect(result.success).toBe(false);
  });
});

describe('createServerConfigInputSchema', () => {
  it('accepts just the user-submitted fields', () => {
    const result = createServerConfigInputSchema.safeParse({
      name: 'github',
      url: 'https://example.com/github-mcp',
      auth: { type: 'none' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-URL', () => {
    const result = createServerConfigInputSchema.safeParse({
      name: 'github',
      url: 'not-a-url',
      auth: { type: 'none' },
    });
    expect(result.success).toBe(false);
  });
});
