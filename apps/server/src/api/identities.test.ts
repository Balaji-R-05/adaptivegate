import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, eq, and, isNull, makeColumns, type Row } from './__testUtils__/fakeDb';

const identitiesTable = makeColumns([
  'id',
  'userId',
  'name',
  'serverScope',
  'budgetLimit',
  'policyId',
  'enabled',
  'createdAt',
]);
const apiKeysTable = makeColumns([
  'id',
  'userId',
  'identityId',
  'hashedKey',
  'label',
  'createdAt',
  'revokedAt',
]);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  identities: identitiesTable,
  apiKeys: apiKeysTable,
  get db() {
    return createFakeDb(tables);
  },
}));

vi.mock('drizzle-orm', () => ({ eq, and, isNull }));

const { identitiesRouter } = await import('./identities');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', identitiesRouter);
  return app;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface IdentityBody {
  id: string;
  userId: string;
  name: string;
  key?: string;
}

const userAIdentity: Row = {
  id: 'identity-a',
  userId: 'user-a',
  name: 'coding-agent',
  serverScope: null,
  budgetLimit: 50,
  policyId: null,
  enabled: true,
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  tables = new Map<object, Row[]>([
    [identitiesTable, [{ ...userAIdentity }]],
    [apiKeysTable, []],
  ]);
});

describe('GET /', () => {
  it("only returns the requesting user's identities", async () => {
    const res = await buildApp('user-a').request('/');
    const body = await jsonBody<IdentityBody[]>(res);
    expect(body).toHaveLength(1);
    expect(body[0]?.name).toBe('coding-agent');
  });

  it('returns nothing for a different user', async () => {
    const res = await buildApp('user-b').request('/');
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /', () => {
  it('creates an identity and mints a one-time key scoped to it', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'research-agent', serverScope: null, budgetLimit: 10, policyId: null }),
    });
    expect(res.status).toBe(201);
    const body = await jsonBody<IdentityBody>(res);
    expect(body.key).toMatch(/^ag_/);

    const createdKey = tables.get(apiKeysTable)?.find((row) => row.label === 'research-agent (identity key)');
    expect(createdKey?.identityId).toBe(body.id);
    expect(createdKey?.hashedKey).not.toBe(body.key);
  });

  it('rejects an empty name', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /:id', () => {
  it("cannot edit another user's identity", async () => {
    const res = await buildApp('user-b').request('/identity-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(404);
  });

  it('toggles the kill switch on the owner\'s own identity', async () => {
    const res = await buildApp('user-a').request('/identity-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<IdentityBody & { enabled: boolean }>(res)).enabled).toBe(false);
  });
});

describe('DELETE /:id', () => {
  it("cannot delete another user's identity", async () => {
    const res = await buildApp('user-b').request('/identity-a', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(tables.get(identitiesTable)).toHaveLength(1);
  });

  it("deletes the owner's own identity", async () => {
    const res = await buildApp('user-a').request('/identity-a', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.get(identitiesTable)).toHaveLength(0);
  });
});
