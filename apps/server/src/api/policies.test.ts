import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, eq, and, isNull, makeColumns, type Row } from './__testUtils__/fakeDb';

const policiesTable = makeColumns(['id', 'userId', 'name', 'version', 'yaml', 'createdAt']);
const identitiesTable = makeColumns(['id', 'userId', 'name', 'policyId']);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  policies: policiesTable,
  identities: identitiesTable,
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
  tables = new Map<object, Row[]>([
    [policiesTable, [{ ...userAPolicy }]],
    [identitiesTable, []],
  ]);
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

// reassignPolicyId is validated as z.string().uuid() (packages/shared's
// deletePolicyInputSchema), unlike every other id in this test file — real
// policy ids are real UUIDs (the db generates them via defaultRandom()),
// so these tests need UUID-shaped fixtures specifically for that field.
const POLICY_B_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_USER_POLICY_ID = '44444444-4444-4444-4444-444444444444';

describe('DELETE /:id', () => {
  it('deletes a policy owned by the requesting user', async () => {
    const res = await buildApp('user-a').request('/policy-a', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.get(policiesTable)).toEqual([]);
  });

  it("refuses to delete a different user's policy", async () => {
    const res = await buildApp('user-b').request('/policy-a', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(tables.get(policiesTable)).toHaveLength(1);
  });

  it('falls identities pinned to the deleted policy back to no pin, when no reassignment is given', async () => {
    tables.set(identitiesTable, [
      { id: 'identity-1', userId: 'user-a', name: 'coding-agent', policyId: 'policy-a' },
    ]);
    const res = await buildApp('user-a').request('/policy-a', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.get(identitiesTable)?.[0]?.policyId).toBeNull();
  });

  it('reassigns identities pinned to the deleted policy, when given a replacement', async () => {
    tables.set(policiesTable, [{ ...userAPolicy }, { ...userAPolicy, id: POLICY_B_ID, name: 'stricter' }]);
    tables.set(identitiesTable, [
      { id: 'identity-1', userId: 'user-a', name: 'coding-agent', policyId: 'policy-a' },
    ]);
    const res = await buildApp('user-a').request('/policy-a', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignPolicyId: POLICY_B_ID }),
    });
    expect(res.status).toBe(204);
    expect(tables.get(identitiesTable)?.[0]?.policyId).toBe(POLICY_B_ID);
  });

  it("rejects a reassignPolicyId that doesn't belong to the requesting user", async () => {
    tables.set(policiesTable, [
      { ...userAPolicy },
      {
        id: OTHER_USER_POLICY_ID,
        userId: 'user-b',
        name: 'not-mine',
        version: 1,
        yaml: userAPolicy.yaml,
        createdAt: new Date(),
      },
    ]);
    const res = await buildApp('user-a').request('/policy-a', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignPolicyId: OTHER_USER_POLICY_ID }),
    });
    expect(res.status).toBe(400);
    expect(tables.get(policiesTable)).toHaveLength(2);
  });

  it('rejects reassigning identities to the same policy being deleted', async () => {
    tables.set(policiesTable, [{ ...userAPolicy, id: POLICY_B_ID }]);
    const res = await buildApp('user-a').request(`/${POLICY_B_ID}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignPolicyId: POLICY_B_ID }),
    });
    expect(res.status).toBe(400);
    expect(tables.get(policiesTable)).toHaveLength(1);
  });
});
