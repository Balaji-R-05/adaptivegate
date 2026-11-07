import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDownstream = vi.fn();
vi.mock('./downstreamClient', () => ({ connectDownstream }));

const { getPooledConnection, evictConnection } = await import('./downstreamPool');

function fakeClient(id: string) {
  return { id, close: vi.fn(async () => {}) };
}

// The pool is module-level state with no reset hook (by design — same as
// the real downstream pool it tests), so each test uses its own serverId to
// avoid pollution across tests in this file rather than clearing anything.
let testId = 0;
function uniqueServerId(): string {
  testId += 1;
  return `server-${testId}`;
}

beforeEach(() => {
  connectDownstream.mockReset();
});

describe('getPooledConnection', () => {
  it('reuses an existing connection for the same (serverId, url, auth.type)', async () => {
    const serverId = uniqueServerId();
    const client = fakeClient('a');
    connectDownstream.mockResolvedValueOnce(client);

    const first = await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });
    const second = await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });

    expect(first).toBe(client);
    expect(second).toBe(client);
    expect(connectDownstream).toHaveBeenCalledTimes(1);
  });

  it('connects fresh when the same serverId resolves to a different url', async () => {
    const serverId = uniqueServerId();
    const clientA = fakeClient('a');
    const clientB = fakeClient('b');
    connectDownstream.mockResolvedValueOnce(clientA).mockResolvedValueOnce(clientB);

    const a = await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });
    const b = await getPooledConnection(serverId, 'http://y/mcp', { type: 'none' });

    expect(a).toBe(clientA);
    expect(b).toBe(clientB);
    expect(connectDownstream).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight connect across concurrent callers', async () => {
    const serverId = uniqueServerId();
    let resolveConnect!: (client: unknown) => void;
    connectDownstream.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveConnect = resolve;
      }),
    );

    const pending1 = getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });
    const pending2 = getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });

    const client = fakeClient('a');
    resolveConnect(client);

    expect(await pending1).toBe(client);
    expect(await pending2).toBe(client);
    expect(connectDownstream).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed connect — the next call retries fresh', async () => {
    const serverId = uniqueServerId();
    connectDownstream.mockRejectedValueOnce(new Error('connection refused'));
    await expect(
      getPooledConnection(serverId, 'http://x/mcp', { type: 'none' }),
    ).rejects.toThrow('connection refused');

    const client = fakeClient('a');
    connectDownstream.mockResolvedValueOnce(client);
    const result = await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });

    expect(result).toBe(client);
    expect(connectDownstream).toHaveBeenCalledTimes(2);
  });
});

describe('evictConnection', () => {
  it('closes the pooled client and removes it so the next call reconnects', async () => {
    const serverId = uniqueServerId();
    const clientA = fakeClient('a');
    const clientB = fakeClient('b');
    connectDownstream.mockResolvedValueOnce(clientA).mockResolvedValueOnce(clientB);

    await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });
    await evictConnection(serverId, 'http://x/mcp', { type: 'none' });

    expect(clientA.close).toHaveBeenCalledTimes(1);

    const result = await getPooledConnection(serverId, 'http://x/mcp', { type: 'none' });
    expect(result).toBe(clientB);
    expect(connectDownstream).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for a key that was never pooled', async () => {
    const serverId = uniqueServerId();
    await expect(
      evictConnection(serverId, 'http://x/mcp', { type: 'none' }),
    ).resolves.toBeUndefined();
  });
});
