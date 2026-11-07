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

// Exported separately from index.ts so tests can hit routes directly
// (via app.request(...)) without binding to a real port.
export const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));
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
app.use('/api/*', requireUser);
app.route('/api/servers', serversRouter);
app.route('/api/keys', apiKeysRouter);
app.route('/api/policies', policiesRouter);
app.route('/api/events', eventsRouter);
app.route('/api/identities', identitiesRouter);
app.route('/api/approvals', approvalsRouter);
