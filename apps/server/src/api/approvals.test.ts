import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, and, desc, eq, makeColumns, type Row } from './__testUtils__/fakeDb';

const approvalsTable = makeColumns([
  'id',
  'userId',
  'identityId',
  'tool',
  'serverId',
  'argumentsRedacted',
  'ruleName',
  'status',
  'decidedAt',
  'consumedAt',
  'expiresAt',
  'createdAt',
]);

let tables: Map<object, Row[]>;

vi.mock('@adaptivegate/db', () => ({
  approvals: approvalsTable,
  get db() {
    return createFakeDb(tables);
  },
}));

vi.mock('drizzle-orm', () => ({ eq, and, desc }));

const recordEventMock = vi.fn();
vi.mock('../governance/auditLog', () => ({ recordEvent: recordEventMock }));

const { approvalsRouter } = await import('./approvals');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', approvalsRouter);
  return app;
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const pendingApproval: Row = {
  id: 'approval-a',
  userId: 'user-a',
  identityId: null,
  tool: 'echo',
  serverId: 'server-1',
  argumentsRedacted: { message: 'hi' },
  ruleName: 'review-echo',
  status: 'pending',
  decidedAt: null,
  consumedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date('2026-01-01'),
};

const expiredApproval: Row = {
  ...pendingApproval,
  id: 'approval-expired',
  expiresAt: new Date(Date.now() - 60_000),
};

beforeEach(() => {
  tables = new Map([[approvalsTable, [{ ...pendingApproval }]]]);
  recordEventMock.mockClear();
});

describe('GET /', () => {
  it("only returns the requesting user's approvals, with isExpired computed", async () => {
    const res = await buildApp('user-a').request('/');
    const body = await jsonBody<Array<Row & { isExpired: boolean }>>(res);
    expect(body).toHaveLength(1);
    expect(body[0]?.isExpired).toBe(false);
  });

  it('flags a pending approval past its expiry as expired', async () => {
    tables = new Map([[approvalsTable, [{ ...expiredApproval }]]]);
    const res = await buildApp('user-a').request('/');
    const body = await jsonBody<Array<Row & { isExpired: boolean }>>(res);
    expect(body[0]?.isExpired).toBe(true);
  });

  it('returns nothing for a different user', async () => {
    const res = await buildApp('user-b').request('/');
    expect(await res.json()).toEqual([]);
  });
});

describe('PATCH /:id', () => {
  it("cannot resolve another user's approval", async () => {
    const res = await buildApp('user-b').request('/approval-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    expect(res.status).toBe(404);
  });

  it('approves a pending approval and logs an approval_decision event', async () => {
    const res = await buildApp('user-a').request('/approval-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    expect(res.status).toBe(200);
    expect((await jsonBody<Row>(res)).status).toBe('approved');
    expect(recordEventMock).toHaveBeenCalledTimes(1);
    expect(recordEventMock.mock.calls[0]?.[0]).toMatchObject({ type: 'approval_decision' });
  });

  it('rejects resolving an already-decided approval', async () => {
    tables = new Map([[approvalsTable, [{ ...pendingApproval, status: 'denied' }]]]);
    const res = await buildApp('user-a').request('/approval-a', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects resolving an expired approval', async () => {
    tables = new Map([[approvalsTable, [{ ...expiredApproval }]]]);
    const res = await buildApp('user-a').request('/approval-expired', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
    expect(res.status).toBe(409);
  });
});
