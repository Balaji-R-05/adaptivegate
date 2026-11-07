import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Context } from 'hono';
import { verifyApiKey } from '../auth/apiKey';
import { createGatewayServer } from './gatewayServer';

function unauthorized(c: Context) {
  return c.json({ error: 'unauthorized' }, 401);
}

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

  // Stateless mode (no session persistence) — see gatewayServer.ts's
  // connection-per-call note. Revisit when live updates (build-order step 8)
  // need real server-initiated push over this transport.
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createGatewayServer(verified.userId, verified.identity);
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}
