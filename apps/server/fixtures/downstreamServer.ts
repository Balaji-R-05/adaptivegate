/**
 * A minimal downstream MCP server, used only as a dev/test fixture to proxy
 * to — not part of the AdaptiveGate product. Exposes one `echo` tool over
 * Streamable HTTP, matching CLAUDE.md's "remote HTTP/SSE servers only" rule
 * for what a real downstream server looks like.
 *
 * Run with: pnpm --filter @adaptivegate/server run fixture:downstream
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

function buildServer() {
  const server = new McpServer({ name: 'adaptivegate-fixture-downstream', version: '0.0.0' });

  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Returns the given message unchanged',
      inputSchema: { message: z.string() },
    },
    async ({ message }) => ({
      content: [{ type: 'text', text: message }],
    }),
  );

  return server;
}

const app = new Hono();

app.all('/mcp', async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = buildServer();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

const port = Number(process.env.FIXTURE_DOWNSTREAM_PORT ?? 3100);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`fixture downstream server listening on http://localhost:${info.port}/mcp`);
});
