import { describe, expect, it } from 'vitest';
import { noRecoveryPolicy } from './noRecovery';

describe('noRecoveryPolicy', () => {
  it('passes through a successful result', async () => {
    const policy = noRecoveryPolicy(async () => 'ok');
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'ok', attempts: 1, recovered: false });
  });

  it('propagates a failure without retrying', async () => {
    let calls = 0;
    const policy = noRecoveryPolicy(async () => {
      calls += 1;
      throw new Error('fails');
    });
    await expect(policy.run()).rejects.toThrow('fails');
    expect(calls).toBe(1);
  });
});
