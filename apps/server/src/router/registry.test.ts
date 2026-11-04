import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolEmbeddingsTable = { serverId: 'serverId', toolName: 'toolName' };

let upsertedRows: Array<Record<string, unknown>> = [];

vi.mock('@adaptivegate/db', () => ({
  toolEmbeddings: toolEmbeddingsTable,
  db: {
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
    closeMock.mockClear();
  });

  it('upserts one row per downstream tool, embedded', async () => {
    const count = await syncToolsForServer({
      id: 'server-1',
      userId: 'user-1',
      url: 'http://x/mcp',
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
    await syncToolsForServer({ id: 'server-1', userId: 'user-1', url: 'http://x/mcp' });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
