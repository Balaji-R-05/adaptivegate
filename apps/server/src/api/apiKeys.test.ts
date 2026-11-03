import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, eq, and, isNull, makeColumns, type Row } from './__testUtils__/fakeDb';

const apiKeysTable = makeColumns(['id', 'userId', 'hashedKey', 'label', 'createdAt', 'revokedAt']);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  apiKeys: apiKeysTable,
  get db() {
    return createFakeDb(tables);
  },
}));

vi.mock('drizzle-orm', () => ({ eq, and, isNull }));

const { apiKeysRouter } = await import('./apiKeys');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', apiKeysRouter);
  return app;
}

interface ApiKeyListItem {
  id: string;
  label: string;
}

interface CreatedApiKey {
  id: string;
  label: string;
  key: string;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const userAKey: Row = {
  id: 'key-a',
  userId: 'user-a',
  hashedKey: 'deadbeef',
  label: 'laptop',
  createdAt: new Date('2026-01-01'),
  revokedAt: null,
};

beforeEach(() => {
  tables = new Map([[apiKeysTable, [{ ...userAKey }]]]);
});

describe('GET /', () => {
  it("only returns the requesting user's keys, without the hash", async () => {
    const res = await buildApp('user-a').request('/');
    const body = await jsonBody<ApiKeyListItem[]>(res);
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty('hashedKey');
    expect(body[0]?.label).toBe('laptop');
  });

  it('returns nothing for a different user', async () => {
    const res = await buildApp('user-b').request('/');
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /', () => {
  it('creates a key for the requesting user and returns the raw key once', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'new key' }),
    });
    expect(res.status).toBe(201);
    const body = await jsonBody<CreatedApiKey>(res);
    expect(body.key).toMatch(/^ag_/);

    const stored = tables.get(apiKeysTable)?.find((r) => r.label === 'new key');
    expect(stored?.hashedKey).not.toBe(body.key);
  });

  it('rejects an empty label', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /:id/revoke', () => {
  it("cannot revoke another user's key", async () => {
    const res = await buildApp('user-b').request('/key-a/revoke', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(tables.get(apiKeysTable)?.[0]?.revokedAt).toBeNull();
  });

  it("revokes the owner's own key", async () => {
    const res = await buildApp('user-a').request('/key-a/revoke', { method: 'POST' });
    expect(res.status).toBe(204);
    expect(tables.get(apiKeysTable)?.[0]?.revokedAt).not.toBeNull();
  });
});
