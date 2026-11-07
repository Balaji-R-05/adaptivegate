import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiKeysRouter } from './api/apiKeys';
import { approvalsRouter } from './api/approvals';
import { eventsRouter } from './api/events';
import { identitiesRouter } from './api/identities';
import { policiesRouter } from './api/policies';
import { serversRouter } from './api/servers';
import { requireUser } from './auth/supabaseAuth';
import { mcpHandler } from './mcp/route';
import { ipRateLimit, userRateLimit } from './rateLimit/middleware';
import { createRateLimiter } from './rateLimit/rateLimiter';

// Exported separately from index.ts so tests can hit routes directly
// (via app.request(...)) without binding to a real port.
export const app = new Hono();

// Blunt, pre-auth defense against anonymous hammering of either route tree
// — generous on purpose, since real abuse should be caught by the tighter
// per-user limiters below. In-memory (see rateLimit/rateLimiter.ts) — fine
// for this project's single-process, invite-only scope.
const ipLimiter = createRateLimiter({ windowMs: 60_000, max: 300 });
// Per-user, applied to /api/* below and inline in mcp/route.ts for /mcp
// (whose user id is only known partway through the handler, after
// verifyApiKey runs). This also bounds embedText calls per user — every
// embedding call in this codebase (apps/server/src/embeddings/embed.ts) is
// only ever reached from inside these two route trees (search_tools behind
// /mcp, tool indexing on server create behind /api/servers), so there's no
// separate embedding-specific limiter to add.
const userLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

app.get('/health', (c) => c.json({ status: 'ok' }));
app.use('/mcp', ipRateLimit(ipLimiter));
app.all('/mcp', mcpHandler);

// /api/* is the dashboard's REST API, authenticated via Supabase session —
// a different scheme from /mcp's AdaptiveGate API keys (see
// src/auth/supabaseAuth.ts). The dashboard is a separate origin (its own
// Vite dev server / deployment), so without CORS every browser-side fetch
// to these routes fails silently before `requireUser` ever runs — the
// dashboard just looks empty, with no console-visible error from this app.
app.use(
  '/api/*',
  cors({
    origin: process.env.DASHBOARD_URL ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use('/api/*', ipRateLimit(ipLimiter));
app.use('/api/*', requireUser);
app.use('/api/*', userRateLimit(userLimiter, (c) => c.get('userId')));
app.route('/api/servers', serversRouter);
app.route('/api/keys', apiKeysRouter);
app.route('/api/policies', policiesRouter);
app.route('/api/events', eventsRouter);
app.route('/api/identities', identitiesRouter);
app.route('/api/approvals', approvalsRouter);
