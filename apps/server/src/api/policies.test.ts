import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, eq, and, isNull, makeColumns, type Row } from './__testUtils__/fakeDb';

const policiesTable = makeColumns(['id', 'userId', 'name', 'version', 'yaml', 'createdAt']);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  policies: policiesTable,
  get db() {
    return createFakeDb(tables);
  },
}));

vi.mock('drizzle-orm', () => ({ eq, and, isNull }));

const { policiesRouter } = await import('./policies');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', policiesRouter);
  return app;
}

interface PolicyBody {
  id: string;
  userId: string;
  name: string;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const userAPolicy: Row = {
  id: 'policy-a',
  userId: 'user-a',
  name: 'allow-all',
  version: 1,
  yaml: 'version: 1\nrules:\n  - name: allow-all\n    match: { tool: "*" }\n    action: allow\n',
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  tables = new Map([[policiesTable, [{ ...userAPolicy }]]]);
});

describe('GET /', () => {
  it("only returns the requesting user's policies", async () => {
    const res = await buildApp('user-a').request('/');
    const body = await jsonBody<PolicyBody[]>(res);
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('policy-a');
  });

  it('returns nothing for a different user', async () => {
    const res = await buildApp('user-b').request('/');
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /', () => {
  it('creates a policy owned by the requesting user', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'deny-deletes',
        yaml: 'version: 1\nrules:\n  - name: no-deletes\n    match: { tool: "filesystem.delete_*" }\n    action: deny\n',
      }),
    });
    expect(res.status).toBe(201);
    expect((await jsonBody<PolicyBody>(res)).userId).toBe('user-a');
  });

  it('rejects input missing required fields', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a policy document that fails schema validation', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'bad', yaml: 'version: 2\nrules: []\n' }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody<{ error: string }>(res)).error).toMatch(/invalid policy document/);
  });

  it('rejects malformed YAML', async () => {
    const res = await buildApp('user-a').request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'bad', yaml: 'not: [valid' }),
    });
    expect(res.status).toBe(400);
    expect((await jsonBody<{ error: string }>(res)).error).toMatch(/invalid YAML/);
  });
});
