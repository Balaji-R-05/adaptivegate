import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const apiKeysTable = Symbol('apiKeys');
const serversTable = Symbol('servers');

let apiKeyRows: Array<{ userId: string }> = [];
let serverRows: Array<{ url: string }> = [];

vi.mock('@adaptivegate/db', () => ({
  apiKeys: apiKeysTable,
  servers: serversTable,
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              table === apiKeysTable ? apiKeyRows : table === serversTable ? serverRows : [],
            ),
        }),
      }),
    }),
  },
}));

const { app } = await import('../app');

let downstream: ReturnType<typeof serve>;
let gateway: ReturnType<typeof serve>;
let gatewayPort: number;

beforeAll(async () => {
  const downstreamApp = new Hono();
  downstreamApp.all('/mcp', async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = new McpServer({ name: 'test-downstream', version: '0.0.0' });
    server.registerTool(
      'echo',
      { title: 'Echo', description: 'echo', inputSchema: { message: z.string() } },
      async ({ message }) => ({ content: [{ type: 'text' as const, text: message }] }),
    );
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  const downstreamPort = await new Promise<number>((resolve) => {
    downstream = serve({ fetch: downstreamApp.fetch, port: 0 }, (info) => resolve(info.port));
  });

  serverRows = [{ url: `http://localhost:${downstreamPort}/mcp` }];

  gatewayPort = await new Promise<number>((resolve) => {
    gateway = serve({ fetch: app.fetch, port: 0 }, (info) => resolve(info.port));
  });
});

afterAll(() => {
  downstream.close();
  gateway.close();
});

describe('/mcp', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await fetch(`http://localhost:${gatewayPort}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown API key', async () => {
    apiKeyRows = [];
    const res = await fetch(`http://localhost:${gatewayPort}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ag_bogus' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('proxies tools/list and tools/call through to the downstream server with a valid key', async () => {
    apiKeyRows = [{ userId: 'user-1' }];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      {
        requestInit: { headers: { Authorization: 'Bearer ag_test-key' } },
      },
    );
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('echo');

    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello' } });
    expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);

    await client.close();
  });
});
