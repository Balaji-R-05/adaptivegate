import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Context } from 'hono';
import { verifyApiKey } from '../auth/apiKey';
import { tooManyRequests } from '../rateLimit/middleware';
import { createRateLimiter } from '../rateLimit/rateLimiter';
import { createGatewayServer } from './gatewayServer';

function unauthorized(c: Context) {
  return c.json({ error: 'unauthorized' }, 401);
}

// Per-user, not per-key — matches the budget/scope checks in
// gatewayServer.ts, which are also keyed on the account, not the key used
// to authenticate. 120/min comfortably covers legitimate agent use (this
// project's own measured call_tool latency is ~2s per call, see
// docs/evaluation.md, which already caps realistic sustained throughput
// well under this) while still bounding runaway or malicious use.
const mcpUserLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

export async function mcpHandler(c: Context) {
  const authHeader = c.req.header('Authorization');
  const rawKey = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!rawKey) {
    return unauthorized(c);
  }

  const verified = await verifyApiKey(rawKey);
  if (!verified) {
    return unauthorized(c);
  }

  const rateLimit = mcpUserLimiter.check(verified.userId);
  if (!rateLimit.allowed) {
    return tooManyRequests(c, rateLimit.remainingMs);
  }

  // Stateless mode (no session persistence) — see gatewayServer.ts's
  // connection-per-call note. Revisit when live updates (build-order step 8)
  // need real server-initiated push over this transport.
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createGatewayServer(verified.userId, verified.identity);
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}
