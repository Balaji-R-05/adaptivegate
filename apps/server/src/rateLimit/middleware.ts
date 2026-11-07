import type { Context, MiddlewareHandler, Next } from 'hono';
import type { createRateLimiter } from './rateLimiter';

type RateLimiter = ReturnType<typeof createRateLimiter>;

// Shared so /mcp's inline check (mcp/route.ts, where the user id is only
// known partway through the handler, after verifyApiKey) and the /api/*
// middleware below produce an identical 429 shape.
export function tooManyRequests(c: Context, remainingMs: number) {
  c.header('Retry-After', String(Math.ceil(remainingMs / 1000)));
  return c.json({ error: 'rate limit exceeded' }, 429);
}

// First line of defense, before auth runs at all — keyed by the client's IP
// (best-effort: trusts x-forwarded-for, same as any single-process deploy
// behind a reverse proxy; there's no auth identity yet to key on at this point).
export function ipRateLimit(limiter: RateLimiter): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for') ?? 'unknown';
    const result = limiter.check(key);
    if (!result.allowed) {
      return tooManyRequests(c, result.remainingMs);
    }
    await next();
  };
}

// Second line, keyed by the authenticated user once known — tighter than
// the IP limiter since it targets one real account's call volume rather
// than blunt anonymous abuse. For routes where the user id is already in
// Hono context (e.g. /api/* after requireUser).
export function userRateLimit(
  limiter: RateLimiter,
  getUserId: (c: Context) => string | undefined,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const userId = getUserId(c);
    if (!userId) {
      await next();
      return;
    }
    const result = limiter.check(userId);
    if (!result.allowed) {
      return tooManyRequests(c, result.remainingMs);
    }
    await next();
  };
}
