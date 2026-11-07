import { describe, expect, it } from 'vitest';
import { createFaultInjector, SimulatedFailureError } from './faultInjector';

async function outcomes(seed: number, failureRate: number, count: number): Promise<boolean[]> {
  const inject = createFaultInjector(seed, failureRate);
  const results: boolean[] = [];
  for (let i = 0; i < count; i++) {
    try {
      await inject(() => 'ok')();
      results.push(true);
    } catch (error) {
      expect(error).toBeInstanceOf(SimulatedFailureError);
      results.push(false);
    }
  }
  return results;
}

describe('createFaultInjector', () => {
  it('produces an identical sequence for the same seed (reproducibility)', async () => {
    const a = await outcomes(42, 0.5, 50);
    const b = await outcomes(42, 0.5, 50);
    expect(a).toEqual(b);
  });

  it('produces a different sequence for a different seed', async () => {
    const a = await outcomes(1, 0.5, 50);
    const b = await outcomes(2, 0.5, 50);
    expect(a).not.toEqual(b);
  });

  it('never fails at failureRate 0', async () => {
    const results = await outcomes(7, 0, 100);
    expect(results.every(Boolean)).toBe(true);
  });

  it('always fails at failureRate 1', async () => {
    const results = await outcomes(7, 1, 100);
    expect(results.some(Boolean)).toBe(false);
  });
});
