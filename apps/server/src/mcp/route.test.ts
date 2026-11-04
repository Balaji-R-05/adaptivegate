import { serve } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const apiKeysTable = Symbol('apiKeys');
const serversTable = Symbol('servers');
const toolEmbeddingsTable = Symbol('toolEmbeddings');

interface UserToolRow {
  name: string;
  description: string;
  serverId: string;
  embedding: number[];
  inputSchema: unknown;
}

let apiKeyRows: Array<{ userId: string }> = [];
let userToolRows: UserToolRow[] = [];
let joinedServerUrlRows: Array<{ url: string }> = [];

vi.mock('@adaptivegate/db', () => ({
  apiKeys: apiKeysTable,
  servers: serversTable,
  toolEmbeddings: toolEmbeddingsTable,
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table === apiKeysTable) {
          return { where: () => ({ limit: () => Promise.resolve(apiKeyRows) }) };
        }
        if (table === toolEmbeddingsTable) {
          return {
            where: () => Promise.resolve(userToolRows),
            innerJoin: () => ({
              where: () => ({ limit: () => Promise.resolve(joinedServerUrlRows) }),
            }),
          };
        }
        return { where: () => Promise.resolve([]) };
      },
    }),
  },
}));

// A fake embedding is enough here — BM25 alone already surfaces the right
// tool for these queries, and the real model would be slow to load in CI.
vi.mock('../embeddings/embed', () => ({
  embedText: async (text: string) => [
    text.length % 7,
    (text.length * 2) % 7,
    (text.length * 3) % 7,
  ],
  EMBEDDING_MODEL: 'test-model',
}));

const { app } = await import('../app');

let downstream: ReturnType<typeof serve>;
let gateway: ReturnType<typeof serve>;
let gatewayPort: number;
let downstreamUrl: string;

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
  downstreamUrl = `http://localhost:${downstreamPort}/mcp`;

  gatewayPort = await new Promise<number>((resolve) => {
    gateway = serve({ fetch: app.fetch, port: 0 }, (info) => resolve(info.port));
  });
});

afterAll(() => {
  downstream.close();
  gateway.close();
});

beforeEach(() => {
  apiKeyRows = [];
  userToolRows = [];
  joinedServerUrlRows = [];
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
    const res = await fetch(`http://localhost:${gatewayPort}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ag_bogus' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('always exposes exactly search_tools and call_tool', async () => {
    apiKeyRows = [{ userId: 'user-1' }];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['call_tool', 'search_tools']);

    await client.close();
  });

  it('search_tools finds an indexed tool, call_tool reaches the real downstream server', async () => {
    apiKeyRows = [{ userId: 'user-1' }];
    userToolRows = [
      {
        name: 'echo',
        description: 'echo',
        serverId: 'server-1',
        embedding: [1, 2, 0],
        inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
      },
    ];
    joinedServerUrlRows = [{ url: downstreamUrl }];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    const searchResult = await client.callTool({
      name: 'search_tools',
      arguments: { query: 'echo a message back' },
    });
    const text = (searchResult.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
    expect(text).toContain('"name": "echo"');

    const callResult = await client.callTool({
      name: 'call_tool',
      arguments: { name: 'echo', arguments: { message: 'hello' } },
    });
    expect(callResult.content).toEqual([{ type: 'text', text: 'hello' }]);

    await client.close();
  });

  it('call_tool rejects a tool name that was never indexed', async () => {
    apiKeyRows = [{ userId: 'user-1' }];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    await expect(
      client.callTool({ name: 'call_tool', arguments: { name: 'nonexistent' } }),
    ).rejects.toThrow();

    await client.close();
  });
});
