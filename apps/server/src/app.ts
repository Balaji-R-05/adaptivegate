import { Hono } from 'hono';
import { mcpHandler } from './mcp/route';

// Exported separately from index.ts so tests can hit routes directly
// (via app.request(...)) without binding to a real port.
export const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));
app.all('/mcp', mcpHandler);
