import { describe, expect, it } from 'vitest';
import { evaluateBudget } from './evaluateBudget';

describe('evaluateBudget', () => {
  it('always allows when no limit is configured (benign case)', () => {
    expect(evaluateBudget(999, null)).toEqual({ allowed: true, remaining: null });
  });

  it('allows when usage is under the limit (benign case)', () => {
    expect(evaluateBudget(3, 5)).toEqual({ allowed: true, remaining: 2 });
  });

  it('denies once usage reaches the limit (blocked case)', () => {
    expect(evaluateBudget(5, 5)).toEqual({ allowed: false, remaining: 0 });
  });

  it('denies when usage already exceeds the limit (blocked case)', () => {
    expect(evaluateBudget(8, 5)).toEqual({ allowed: false, remaining: 0 });
  });
});
