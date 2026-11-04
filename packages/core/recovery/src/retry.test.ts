import { describe, expect, it } from 'vitest';
import { retryPolicy } from './retry';

describe('retryPolicy', () => {
  it('succeeds on the first attempt without retrying', async () => {
    const policy = retryPolicy(async () => 'ok', { maxAttempts: 3, baseDelayMs: 1 });
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'ok', attempts: 1, recovered: false });
  });

  it('recovers after transient failures', async () => {
    let calls = 0;
    const operation = async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient failure');
      return 'ok';
    };

    const policy = retryPolicy(operation, { maxAttempts: 3, baseDelayMs: 1 });
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'ok', attempts: 3, recovered: true });
  });

  it('gives up and throws after maxAttempts', async () => {
    const policy = retryPolicy(
      async () => {
        throw new Error('always fails');
      },
      { maxAttempts: 2, baseDelayMs: 1 },
    );
    await expect(policy.run()).rejects.toThrow('always fails');
  });
});
