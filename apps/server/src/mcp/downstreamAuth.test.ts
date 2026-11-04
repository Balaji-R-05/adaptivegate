import { afterEach, describe, expect, it } from 'vitest';
import { resolveDownstreamHeaders } from './downstreamAuth';

describe('resolveDownstreamHeaders', () => {
  const originalEnv = process.env.TEST_DOWNSTREAM_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEST_DOWNSTREAM_TOKEN;
    } else {
      process.env.TEST_DOWNSTREAM_TOKEN = originalEnv;
    }
  });

  it('returns no headers for "none" auth', () => {
    expect(resolveDownstreamHeaders({ type: 'none' })).toEqual({});
  });

  it('reads the token from the named env var for "bearer" auth', () => {
    process.env.TEST_DOWNSTREAM_TOKEN = 'secret-token';
    expect(resolveDownstreamHeaders({ type: 'bearer', tokenEnv: 'TEST_DOWNSTREAM_TOKEN' })).toEqual(
      {
        Authorization: 'Bearer secret-token',
      },
    );
  });

  it('throws if the named env var is not set', () => {
    delete process.env.TEST_DOWNSTREAM_TOKEN;
    expect(() =>
      resolveDownstreamHeaders({ type: 'bearer', tokenEnv: 'TEST_DOWNSTREAM_TOKEN' }),
    ).toThrow(/TEST_DOWNSTREAM_TOKEN/);
  });
});
