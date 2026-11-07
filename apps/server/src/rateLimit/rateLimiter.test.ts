import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimiter';

describe('createRateLimiter', () => {
  it('allows up to max requests within the window', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
    const now = 0;
    expect(limiter.check('a', now).allowed).toBe(true);
    expect(limiter.check('a', now).allowed).toBe(true);
    expect(limiter.check('a', now).allowed).toBe(true);
  });

  it('blocks the request after max is reached within the window', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    limiter.check('a', 0);
    limiter.check('a', 0);
    const result = limiter.check('a', 0);
    expect(result.allowed).toBe(false);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it('resets once the window elapses', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 500).allowed).toBe(false);
    expect(limiter.check('a', 1001).allowed).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
    expect(limiter.check('b', 0).allowed).toBe(false);
  });
});
