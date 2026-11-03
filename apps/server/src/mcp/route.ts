import { db, servers } from '@adaptivegate/db';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { verifyApiKey } from '../auth/apiKey';
import { createGatewayServer } from './gatewayServer';

function unauthorized(c: Context) {
  return c.json({ error: 'unauthorized' }, 401);
}

// One server per user for now — no routing between multiple servers yet
// (that's the hybrid router, build-order step 5), so this just takes
// whichever one server the user has configured.
async function findConfiguredServerUrl(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ url: servers.url })
    .from(servers)
    .where(eq(servers.userId, userId))
    .limit(1);

  return row?.url ?? null;
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

  const downstreamUrl = await findConfiguredServerUrl(verified.userId);
  if (!downstreamUrl) {
    return c.json({ error: 'no downstream server configured' }, 404);
  }

  // Stateless mode (no session persistence) — see gatewayServer.ts's
  // connection-per-call note. Revisit when live updates (build-order step 8)
  // need real server-initiated push over this transport.
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createGatewayServer(downstreamUrl);
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}
