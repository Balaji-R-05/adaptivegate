import { Hono } from 'hono';
import { apiKeysRouter } from './api/apiKeys';
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
// src/auth/supabaseAuth.ts).
app.use('/api/*', requireUser);
app.route('/api/servers', serversRouter);
app.route('/api/keys', apiKeysRouter);
app.route('/api/policies', policiesRouter);
