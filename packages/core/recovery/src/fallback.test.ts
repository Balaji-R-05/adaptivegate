import { describe, expect, it } from 'vitest';
import { fallbackPolicy } from './fallback';

describe('fallbackPolicy', () => {
  it('uses the primary result when it succeeds', async () => {
    const policy = fallbackPolicy(
      async () => 'primary',
      async () => 'fallback',
    );
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'primary', attempts: 1, recovered: false });
  });

  it('switches to the fallback when the primary fails', async () => {
    const policy = fallbackPolicy(
      async () => {
        throw new Error('primary down');
      },
      async () => 'fallback',
    );
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'fallback', attempts: 2, recovered: true });
  });

  it('propagates the fallback error if both fail', async () => {
    const policy = fallbackPolicy(
      async () => {
        throw new Error('primary down');
      },
      async () => {
        throw new Error('fallback down too');
      },
    );
    await expect(policy.run()).rejects.toThrow('fallback down too');
  });
});
