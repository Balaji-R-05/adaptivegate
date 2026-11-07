import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimiter';
import { ipRateLimit, userRateLimit } from './middleware';

describe('ipRateLimit', () => {
  it('lets a request through under the limit', async () => {
    const app = new Hono();
    app.use(ipRateLimit(createRateLimiter({ windowMs: 1000, max: 2 })));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('returns 429 with Retry-After once the limit is exceeded for one IP', async () => {
    const app = new Hono();
    app.use(ipRateLimit(createRateLimiter({ windowMs: 1000, max: 1 })));
    app.get('/', (c) => c.json({ ok: true }));

    await app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    const res = await app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
  });

  it('does not block a different IP once one is limited', async () => {
    const app = new Hono();
    app.use(ipRateLimit(createRateLimiter({ windowMs: 1000, max: 1 })));
    app.get('/', (c) => c.json({ ok: true }));

    await app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    const blocked = await app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    const allowed = await app.request('/', { headers: { 'x-forwarded-for': '2.2.2.2' } });

    expect(blocked.status).toBe(429);
    expect(allowed.status).toBe(200);
  });
});

describe('userRateLimit', () => {
  it('skips the check when there is no resolved user id', async () => {
    const app = new Hono();
    app.use(userRateLimit(createRateLimiter({ windowMs: 1000, max: 0 }), () => undefined));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('returns 429 once a specific user id exceeds the limit', async () => {
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('userId', 'user-1');
      await next();
    });
    app.use(userRateLimit(createRateLimiter({ windowMs: 1000, max: 1 }), (c) => c.get('userId')));
    app.get('/', (c) => c.json({ ok: true }));

    const first = await app.request('/');
    const second = await app.request('/');

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
