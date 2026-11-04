import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A small, purpose-built fake for the three query shapes events.ts actually
// issues (filtered list with orderBy/limit; grouped counts; single
// jsonb-predicate counts) — not a general drizzle emulator, same spirit as
// ./__testUtils__/fakeDb.ts, which doesn't support groupBy/orderBy/sql.

interface EventRow {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

type Predicate = (row: EventRow) => boolean;
interface Aggregate {
  __aggregate: 'count';
}
type Selection = Record<string, string | Aggregate>;

function isAggregate(value: unknown): value is Aggregate {
  return typeof value === 'object' && value !== null && '__aggregate' in value;
}

function project(row: EventRow, selection?: Selection): Record<string, unknown> {
  if (!selection) return { ...row };
  return Object.fromEntries(
    Object.entries(selection).map(([outKey, col]) => [
      outKey,
      isAggregate(col) ? undefined : row[col as keyof EventRow],
    ]),
  );
}

let rows: EventRow[] = [];

const eventsTable = { userId: 'userId', type: 'type', createdAt: 'createdAt', payload: 'payload' };

vi.mock('drizzle-orm', () => ({
  eq: (column: string, value: unknown): Predicate => (row) =>
    row[column as keyof EventRow] === value,
  and: (...preds: Array<Predicate | undefined>): Predicate => (row) =>
    preds.every((p) => !p || p(row)),
  lt: (column: string, value: Date): Predicate => (row) =>
    (row[column as keyof EventRow] as Date) < value,
  desc: (column: string) => ({ __desc: column }),
  count: (): Aggregate => ({ __aggregate: 'count' }),
  sql: (strings: readonly string[]): Predicate => {
    const field = strings.join('').includes('blocked') ? 'blocked' : 'recovered';
    return (row) => String(row.payload?.[field]) === 'true';
  },
}));

vi.mock('@adaptivegate/db', () => ({
  events: eventsTable,
  db: {
    select(selection?: Selection) {
      return {
        from: () => ({
          where: (predicate?: Predicate) => {
            const filtered = rows.filter((r) => !predicate || predicate(r));
            const aggregateOnly =
              selection &&
              Object.keys(selection).length === 1 &&
              isAggregate(Object.values(selection)[0]);

            return {
              then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
                const result = aggregateOnly
                  ? [{ [Object.keys(selection!)[0]!]: filtered.length }]
                  : filtered.map((r) => project(r, selection));
                return Promise.resolve(result).then(resolve, reject);
              },
              orderBy(descMarker: { __desc: string }) {
                const sorted = [...filtered].sort(
                  (a, b) =>
                    (b[descMarker.__desc as keyof EventRow] as Date).getTime() -
                    (a[descMarker.__desc as keyof EventRow] as Date).getTime(),
                );
                return {
                  then(
                    resolve: (value: unknown) => unknown,
                    reject?: (reason: unknown) => unknown,
                  ) {
                    return Promise.resolve(sorted.map((r) => project(r, selection))).then(
                      resolve,
                      reject,
                    );
                  },
                  limit(n: number) {
                    return Promise.resolve(sorted.slice(0, n).map((r) => project(r, selection)));
                  },
                };
              },
              groupBy(column: string) {
                const groups = new Map<string, EventRow[]>();
                for (const r of filtered) {
                  const key = String(r[column as keyof EventRow]);
                  groups.set(key, [...(groups.get(key) ?? []), r]);
                }
                const result = [...groups.entries()].map(([key, groupRows]) => {
                  const out: Record<string, unknown> = {};
                  for (const [outKey, col] of Object.entries(selection ?? {})) {
                    out[outKey] = isAggregate(col) ? groupRows.length : key;
                  }
                  return out;
                });
                return Promise.resolve(result);
              },
            };
          },
        }),
      };
    },
  },
}));

const { eventsRouter } = await import('./events');

function buildApp(userId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    await next();
  });
  app.route('/', eventsRouter);
  return app;
}

function row(overrides: Partial<EventRow>): EventRow {
  return {
    id: 'evt',
    userId: 'user-a',
    type: 'tool_call',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  rows = [
    row({ id: 'evt-1', type: 'tool_call', payload: { blocked: true }, createdAt: new Date('2026-01-01T00:00:00Z') }),
    row({ id: 'evt-2', type: 'tool_call', payload: { blocked: false }, createdAt: new Date('2026-01-02T00:00:00Z') }),
    row({ id: 'evt-3', type: 'recovery_attempt', payload: { recovered: true }, createdAt: new Date('2026-01-03T00:00:00Z') }),
    row({ id: 'evt-4', type: 'policy_decision', payload: {}, userId: 'user-b', createdAt: new Date('2026-01-04T00:00:00Z') }),
  ];
});

describe('GET /', () => {
  it("only returns the requesting user's events, newest first", async () => {
    const res = await buildApp('user-a').request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as EventRow[];
    expect(body.map((e) => e.id)).toEqual(['evt-3', 'evt-2', 'evt-1']);
  });

  it('filters by type', async () => {
    const res = await buildApp('user-a').request('/?type=tool_call');
    const body = (await res.json()) as EventRow[];
    expect(body.map((e) => e.id).sort()).toEqual(['evt-1', 'evt-2']);
  });

  it('excludes events at or after the before cursor', async () => {
    const res = await buildApp('user-a').request(`/?before=${encodeURIComponent('2026-01-03T00:00:00Z')}`);
    const body = (await res.json()) as EventRow[];
    expect(body.map((e) => e.id)).toEqual(['evt-2', 'evt-1']);
  });

  it('rejects an invalid type', async () => {
    const res = await buildApp('user-a').request('/?type=not_a_real_type');
    expect(res.status).toBe(400);
  });

  it('rejects a limit above the max', async () => {
    const res = await buildApp('user-a').request('/?limit=500');
    expect(res.status).toBe(400);
  });
});

describe('GET /stats', () => {
  it("reports totals, per-type counts, and blocked/recovered scoped to the requesting user", async () => {
    const res = await buildApp('user-a').request('/stats');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      total: 3,
      byType: { tool_call: 2, policy_decision: 0, recovery_attempt: 1, approval_decision: 0 },
      blocked: 1,
      recovered: 1,
    });
  });

  it("does not count another user's events", async () => {
    const res = await buildApp('user-b').request('/stats');
    expect(await res.json()).toMatchObject({ total: 1 });
  });
});
