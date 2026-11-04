import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolEmbeddingsTable = { serverId: 'serverId', toolName: 'toolName' };

let upsertedRows: Array<Record<string, unknown>> = [];
// Consumed one entry per tool, in the order syncToolsForServer processes them
// (same order listDownstreamTools returns: echo, then add) — each entry is
// the "existing row" (or none) that tool's select should find.
let existingRowsQueue: Array<Record<string, unknown>[]> = [];

vi.mock('@adaptivegate/db', () => ({
  toolEmbeddings: toolEmbeddingsTable,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(existingRowsQueue.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: () => {
          upsertedRows.push(values);
          return Promise.resolve();
        },
      }),
    }),
  },
}));

const recordEventMock = vi.fn();

vi.mock('../governance/auditLog', () => ({
  recordEvent: recordEventMock,
}));

const closeMock = vi.fn();

vi.mock('../mcp/downstreamClient', () => ({
  connectDownstream: vi.fn(async () => ({ close: closeMock })),
  listDownstreamTools: vi.fn(async () => ({
    tools: [
      { name: 'echo', description: 'echoes input', inputSchema: { type: 'object' } },
      { name: 'add', description: 'adds two numbers', inputSchema: { type: 'object' } },
    ],
  })),
  callDownstreamTool: vi.fn(),
}));

vi.mock('../embeddings/embed', () => ({
  embedText: vi.fn(async () => [0.1, 0.2, 0.3]),
  EMBEDDING_MODEL: 'test-model',
}));

const { syncToolsForServer } = await import('./registry');

describe('syncToolsForServer', () => {
  beforeEach(() => {
    upsertedRows = [];
    existingRowsQueue = [];
    closeMock.mockClear();
    recordEventMock.mockClear();
  });

  it('upserts one row per downstream tool, embedded', async () => {
    const count = await syncToolsForServer({
      id: 'server-1',
      userId: 'user-1',
      url: 'http://x/mcp',
      auth: { type: 'none' },
    });

    expect(count).toBe(2);
    expect(upsertedRows).toHaveLength(2);
    expect(upsertedRows.map((row) => row.toolName)).toEqual(['echo', 'add']);
    expect(upsertedRows[0]).toMatchObject({
      serverId: 'server-1',
      userId: 'user-1',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'test-model',
    });
  });

  it('closes the downstream connection after syncing', async () => {
    await syncToolsForServer({
      id: 'server-1',
      userId: 'user-1',
      url: 'http://x/mcp',
      auth: { type: 'none' },
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('logs a tool_definition_changed event when a resynced tool description changed', async () => {
    existingRowsQueue = [
      [{ description: 'an old, different description', inputSchema: { type: 'object' } }],
      [{ description: 'adds two numbers', inputSchema: { type: 'object' } }],
    ];

    await syncToolsForServer({
      id: 'server-1',
      userId: 'user-1',
      url: 'http://x/mcp',
      auth: { type: 'none' },
    });

    const integrityEvents = recordEventMock.mock.calls.filter(
      ([event]) => (event.payload as Record<string, unknown>).kind === 'tool_definition_changed',
    );
    expect(integrityEvents.length).toBeGreaterThan(0);
  });

  it('does not log a tool_definition_changed event when the definition is unchanged', async () => {
    existingRowsQueue = [
      [{ description: 'echoes input', inputSchema: { type: 'object' } }],
      [{ description: 'adds two numbers', inputSchema: { type: 'object' } }],
    ];

    await syncToolsForServer({
      id: 'server-1',
      userId: 'user-1',
      url: 'http://x/mcp',
      auth: { type: 'none' },
    });

    const integrityEvents = recordEventMock.mock.calls.filter(
      ([event]) => (event.payload as Record<string, unknown>).kind === 'tool_definition_changed',
    );
    expect(integrityEvents).toHaveLength(0);
  });
});
