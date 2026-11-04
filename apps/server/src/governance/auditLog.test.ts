import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventsTable = { userId: 'userId', createdAt: 'createdAt', hash: 'hash' };

let lastEventRows: Array<{ hash: string }> = [];
let insertedRows: Array<Record<string, unknown>> = [];
let failSelect = false;
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

vi.mock('@adaptivegate/db', () => ({
  events: eventsTable,
  db: {
    select: () => {
      if (failSelect) throw new Error('db unavailable');
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(lastEventRows),
            }),
          }),
        }),
      };
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertedRows.push(values);
        return Promise.resolve();
      },
    }),
  },
}));

const { recordEvent } = await import('./auditLog');

describe('recordEvent', () => {
  beforeEach(() => {
    lastEventRows = [];
    insertedRows = [];
    failSelect = false;
    consoleErrorSpy.mockClear();
  });

  it('writes the first event in a chain with a null previousHash', async () => {
    await recordEvent({ userId: 'user-1', type: 'tool_call', payload: { tool: 'echo' } });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      userId: 'user-1',
      type: 'tool_call',
      previousHash: null,
    });
    expect(typeof insertedRows[0]?.hash).toBe('string');
  });

  it('chains off the previous event when one exists', async () => {
    lastEventRows = [{ hash: 'previous-hash-value' }];
    await recordEvent({ userId: 'user-1', type: 'policy_decision', payload: {} });

    expect(insertedRows[0]).toMatchObject({ previousHash: 'previous-hash-value' });
  });

  it('logs rather than throws if the write fails', async () => {
    failSelect = true;
    await expect(
      recordEvent({ userId: 'user-1', type: 'tool_call', payload: {} }),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(insertedRows).toHaveLength(0);
  });
});
