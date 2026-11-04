import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, eq, and, isNull, makeColumns, type Row } from './__testUtils__/fakeDb';

const serversTable = makeColumns([
  'id',
  'userId',
  'name',
  'url',
  'auth',
  'enabledTools',
  'createdAt',
]);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  servers: serversTable,
  get db() {
    return createFakeDb(tables);
  },
}));

vi.mock('drizzle-orm', () => ({ eq, and, isNull }));

const syncToolsForServer = vi.fn(async () => 0);
vi.mock('../router/registry', () => ({ syncToolsForServer }));

const { serversRouter } = await import('./servers');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', serversRouter);
  return app;
}

interface ServerBody {
  id: string;
  userId: string;
  name: string;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const userAServer: Row = {
  id: 'server-a',
  userId: 'user-a',
  name: 'github',
  url: 'https://example.com/mcp',
  auth: { type: 'none' },
  enabledTools: [],
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  tables = new Map([[serversTable, [{ ...userAServer }]]]);
  syncToolsForServer.mockClear();
});

describe('GET /', () => {
  it("only returns the requesting user's servers", async () => {
    const res = await buildApp('user-a').request('/');
    expect(res.status).toBe(200);
    const body = await jsonBody<ServerBody[]>(res);
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('server-a');
  });

  it('returns nothing for a different user', async () => {
    const res = await buildApp('user-b').request('/');
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /', () => {
  it('creates a server owned by the requesting user', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'docs',
        url: 'https://example.com/docs-mcp',
        auth: { type: 'none' },
      }),
    });
    expect(res.status).toBe(201);
    expect((await jsonBody<ServerBody>(res)).userId).toBe('user-a');
  });

  it('rejects invalid input', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', url: 'not-a-url' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /:id', () => {
  it("cannot edit another user's server", async () => {
    const res = await buildApp('user-b').request('/server-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    });
    expect(res.status).toBe(404);
  });

  it("edits the owner's own server", async () => {
    const res = await buildApp('user-a').request('/server-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<ServerBody>(res)).name).toBe('renamed');
  });
});

describe('POST /:id/resync', () => {
  it("cannot resync another user's server", async () => {
    const res = await buildApp('user-b').request('/server-a/resync', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(syncToolsForServer).not.toHaveBeenCalled();
  });

  it("resyncs the owner's own server and reports the tool count", async () => {
    syncToolsForServer.mockResolvedValueOnce(3);
    const res = await buildApp('user-a').request('/server-a/resync', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ toolCount: 3 });
  });
});

describe('DELETE /:id', () => {
  it("cannot delete another user's server", async () => {
    const res = await buildApp('user-b').request('/server-a', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(tables.get(serversTable)).toHaveLength(1);
  });

  it("deletes the owner's own server", async () => {
    const res = await buildApp('user-a').request('/server-a', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.get(serversTable)).toHaveLength(0);
  });
});
