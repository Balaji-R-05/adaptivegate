// Fixed-window counter, in-memory — no new dependency. Fits this project's
// current scope (invite-only, a handful of users, single process); a later
// move to a shared store (Redis/Upstash) would only replace this file's
// internals, not its call sites (see rateLimit/middleware.ts).
export interface RateLimitResult {
  allowed: boolean;
  // Milliseconds until this key's window resets, whether or not it's
  // currently blocked — used to set a Retry-After header on a 429.
  remainingMs: number;
}

interface Window {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const windows = new Map<string, Window>();

  function check(key: string, now = Date.now()): RateLimitResult {
    let window = windows.get(key);
    if (!window || now - window.windowStart >= windowMs) {
      window = { count: 0, windowStart: now };
      windows.set(key, window);
    }

    const remainingMs = windowMs - (now - window.windowStart);
    if (window.count >= max) {
      return { allowed: false, remainingMs };
    }

    window.count += 1;
    return { allowed: true, remainingMs };
  }

  return { check };
}
