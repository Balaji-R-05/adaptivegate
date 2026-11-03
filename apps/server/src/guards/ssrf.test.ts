import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let resolvedAddress = '93.184.216.34'; // example.com's real address — a benign public IP

vi.mock('node:dns/promises', () => ({
  lookup: () => Promise.resolve({ address: resolvedAddress, family: 4 }),
}));

const { assertSafeDownstreamUrl, UnsafeDownstreamUrlError } = await import('./ssrf');

describe('assertSafeDownstreamUrl', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    // The checks only run in production — private addresses are allowed
    // outside it (our own dev fixture server runs on localhost).
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects a non-http(s) URL', async () => {
    await expect(assertSafeDownstreamUrl('ftp://example.com')).rejects.toThrow(
      UnsafeDownstreamUrlError,
    );
  });

  it('rejects a hostname that resolves to a private IP', async () => {
    resolvedAddress = '10.0.0.5';
    await expect(assertSafeDownstreamUrl('https://internal.example.com')).rejects.toThrow(
      UnsafeDownstreamUrlError,
    );
  });

  it('rejects a hostname that resolves to the cloud metadata address', async () => {
    resolvedAddress = '169.254.169.254';
    await expect(assertSafeDownstreamUrl('https://metadata.example.com')).rejects.toThrow(
      UnsafeDownstreamUrlError,
    );
  });

  it('allows a hostname that resolves to an ordinary public IP', async () => {
    resolvedAddress = '93.184.216.34';
    await expect(assertSafeDownstreamUrl('https://example.com/mcp')).resolves.toBeUndefined();
  });

  it('allows private addresses outside production', async () => {
    process.env.NODE_ENV = 'development';
    resolvedAddress = '127.0.0.1';
    await expect(assertSafeDownstreamUrl('http://localhost:3100/mcp')).resolves.toBeUndefined();
  });
});
