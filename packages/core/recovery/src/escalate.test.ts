import { describe, expect, it } from 'vitest';
import { EscalationRequiredError, escalatePolicy } from './escalate';

describe('escalatePolicy', () => {
  it('passes through a successful result', async () => {
    const policy = escalatePolicy(async () => 'ok');
    const outcome = await policy.run();
    expect(outcome).toEqual({ result: 'ok', attempts: 1, recovered: false });
  });

  it('throws EscalationRequiredError on failure, without retrying', async () => {
    let calls = 0;
    const policy = escalatePolicy(async () => {
      calls += 1;
      throw new Error('cannot proceed');
    });
    await expect(policy.run()).rejects.toThrow(EscalationRequiredError);
    expect(calls).toBe(1);
  });
});
