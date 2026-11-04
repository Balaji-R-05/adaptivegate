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
const policiesTable = Symbol('policies');
const eventsTable = Symbol('events');

interface UserToolRow {
  name: string;
  description: string;
  serverId: string;
  embedding: number[];
  inputSchema: unknown;
}

const ALLOW_ALL_POLICY_YAML =
  'version: 1\nrules:\n  - name: allow-all\n    match: { tool: "*" }\n    action: allow\n';

let apiKeyRows: Array<{ userId: string }> = [];
let userToolRows: UserToolRow[] = [];
let joinedServerUrlRows: Array<{ url: string; auth: { type: 'none' } }> = [];
let policyRows: Array<{ yaml: string }> = [{ yaml: ALLOW_ALL_POLICY_YAML }];

vi.mock('@adaptivegate/db', () => ({
  apiKeys: apiKeysTable,
  servers: serversTable,
  toolEmbeddings: toolEmbeddingsTable,
  policies: policiesTable,
  events: eventsTable,
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
        if (table === policiesTable) {
          return {
            where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(policyRows) }) }),
          };
        }
        if (table === eventsTable) {
          return { where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) };
        }
        return { where: () => Promise.resolve([]) };
      },
    }),
    insert: () => ({ values: () => Promise.resolve() }),
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

function buildEchoFixture(prefix: string) {
  const fixtureApp = new Hono();
  fixtureApp.all('/mcp', async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = new McpServer({ name: `test-downstream-${prefix}`, version: '0.0.0' });
    server.registerTool(
      'echo',
      { title: 'Echo', description: 'echo', inputSchema: { message: z.string() } },
      async ({ message }) => ({
        content: [{ type: 'text' as const, text: `${prefix}${message}` }],
      }),
    );
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return fixtureApp;
}

let downstream: ReturnType<typeof serve>;
let downstream2: ReturnType<typeof serve>;
let gateway: ReturnType<typeof serve>;
let gatewayPort: number;
let downstreamUrl: string;
let downstream2Url: string;

beforeAll(async () => {
  // Two separate downstream servers that both happen to expose a tool
  // literally named "echo" — the same real-world situation that surfaced
  // the serverId bug (see rrf.test.ts's regression test).
  const downstreamPort = await new Promise<number>((resolve) => {
    downstream = serve({ fetch: buildEchoFixture('').fetch, port: 0 }, (info) =>
      resolve(info.port),
    );
  });
  downstreamUrl = `http://localhost:${downstreamPort}/mcp`;

  const downstream2Port = await new Promise<number>((resolve) => {
    downstream2 = serve({ fetch: buildEchoFixture('SERVER-2: ').fetch, port: 0 }, (info) =>
      resolve(info.port),
    );
  });
  downstream2Url = `http://localhost:${downstream2Port}/mcp`;

  gatewayPort = await new Promise<number>((resolve) => {
    gateway = serve({ fetch: app.fetch, port: 0 }, (info) => resolve(info.port));
  });
});

afterAll(() => {
  downstream.close();
  downstream2.close();
  gateway.close();
});

beforeEach(() => {
  apiKeyRows = [];
  userToolRows = [];
  joinedServerUrlRows = [];
  policyRows = [{ yaml: ALLOW_ALL_POLICY_YAML }];
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
    joinedServerUrlRows = [{ url: downstreamUrl, auth: { type: 'none' } }];

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
      arguments: { name: 'echo', serverId: 'server-1', arguments: { message: 'hello' } },
    });
    expect(callResult.content).toEqual([{ type: 'text', text: 'hello' }]);

    await client.close();
  });

  it('call_tool reaches the right server when two servers share a tool name', async () => {
    apiKeyRows = [{ userId: 'user-1' }];
    userToolRows = [
      {
        name: 'echo',
        description: 'echo',
        serverId: 'server-1',
        embedding: [1, 0, 0],
        inputSchema: {},
      },
      {
        name: 'echo',
        description: 'echo',
        serverId: 'server-2',
        embedding: [1, 0, 0],
        inputSchema: {},
      },
    ];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    joinedServerUrlRows = [{ url: downstreamUrl, auth: { type: 'none' } }];
    const resultFromServer1 = await client.callTool({
      name: 'call_tool',
      arguments: { name: 'echo', serverId: 'server-1', arguments: { message: 'hi' } },
    });
    expect(resultFromServer1.content).toEqual([{ type: 'text', text: 'hi' }]);

    joinedServerUrlRows = [{ url: downstream2Url, auth: { type: 'none' } }];
    const resultFromServer2 = await client.callTool({
      name: 'call_tool',
      arguments: { name: 'echo', serverId: 'server-2', arguments: { message: 'hi' } },
    });
    expect(resultFromServer2.content).toEqual([{ type: 'text', text: 'SERVER-2: hi' }]);

    await client.close();
  });

  it('call_tool is blocked by a deny policy before ever reaching the downstream server', async () => {
    apiKeyRows = [{ userId: 'user-1' }];
    userToolRows = [
      {
        name: 'echo',
        description: 'echo',
        serverId: 'server-1',
        embedding: [1, 0, 0],
        inputSchema: {},
      },
    ];
    joinedServerUrlRows = [{ url: downstreamUrl, auth: { type: 'none' } }];
    policyRows = [
      {
        yaml: 'version: 1\nrules:\n  - name: no-echo\n    match: { tool: "echo" }\n    action: deny\n',
      },
    ];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    await expect(
      client.callTool({
        name: 'call_tool',
        arguments: { name: 'echo', serverId: 'server-1', arguments: { message: 'hello' } },
      }),
    ).rejects.toThrow(/denied by policy/);

    await client.close();
  });

  it('call_tool denies by default when the account has no policy configured', async () => {
    apiKeyRows = [{ userId: 'user-1' }];
    userToolRows = [
      {
        name: 'echo',
        description: 'echo',
        serverId: 'server-1',
        embedding: [1, 0, 0],
        inputSchema: {},
      },
    ];
    joinedServerUrlRows = [{ url: downstreamUrl, auth: { type: 'none' } }];
    policyRows = [];

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${gatewayPort}/mcp`),
      { requestInit: { headers: { Authorization: 'Bearer ag_test-key' } } },
    );
    await client.connect(transport);

    await expect(
      client.callTool({
        name: 'call_tool',
        arguments: { name: 'echo', serverId: 'server-1', arguments: { message: 'hello' } },
      }),
    ).rejects.toThrow(/denied by policy/);

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
      client.callTool({
        name: 'call_tool',
        arguments: { name: 'nonexistent', serverId: 'server-1' },
      }),
    ).rejects.toThrow();

    await client.close();
  });
});
