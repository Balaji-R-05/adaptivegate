import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventsTable = { userId: 'userId', createdAt: 'createdAt', hash: 'hash' };

let lastEventRows: Array<{ hash: string }> = [];
let insertedRows: Array<Record<string, unknown>> = [];
let failSelect = false;
let failNextInsert = false;
let selectCount = 0;
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

vi.mock('@adaptivegate/db', () => ({
  events: eventsTable,
  db: {
    select: () => {
      selectCount += 1;
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
        if (failNextInsert) {
          failNextInsert = false;
          return Promise.reject(new Error('insert failed'));
        }
        insertedRows.push(values);
        return Promise.resolve();
      },
    }),
  },
}));

const { recordEvent, createEventRecorder } = await import('./auditLog');

describe('recordEvent', () => {
  beforeEach(() => {
    lastEventRows = [];
    insertedRows = [];
    failSelect = false;
    failNextInsert = false;
    selectCount = 0;
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

describe('createEventRecorder', () => {
  beforeEach(() => {
    lastEventRows = [];
    insertedRows = [];
    failSelect = false;
    failNextInsert = false;
    selectCount = 0;
    consoleErrorSpy.mockClear();
  });

  it('fetches the chain tip once, then chains subsequent records locally with no extra SELECT', async () => {
    lastEventRows = [{ hash: 'tip-hash' }];
    const recorder = createEventRecorder('user-1');

    await recorder.record('policy_decision', { verdict: 'allow' });
    expect(selectCount).toBe(1);
    expect(insertedRows[0]).toMatchObject({ previousHash: 'tip-hash' });
    const firstHash = insertedRows[0]?.hash as string;

    await recorder.record('tool_call', { blocked: false });
    expect(selectCount).toBe(1); // still just the one SELECT from before
    expect(insertedRows[1]).toMatchObject({ previousHash: firstHash });
  });

  it('chains the first record from null when the user has no prior events', async () => {
    lastEventRows = [];
    const recorder = createEventRecorder('user-1');

    await recorder.record('tool_call', { tool: 'echo' });
    expect(insertedRows[0]).toMatchObject({ previousHash: null });
  });

  it('does not advance previousHash past a failed write', async () => {
    lastEventRows = [{ hash: 'tip-hash' }];
    const recorder = createEventRecorder('user-1');
    await recorder.record('policy_decision', { verdict: 'allow' });

    failNextInsert = true;
    await recorder.record('tool_call', { blocked: false });
    expect(consoleErrorSpy).toHaveBeenCalled();

    await recorder.record('recovery_attempt', { attempts: 2 });
    // Chains from the last *successful* insert's hash, not the failed one.
    expect(insertedRows.at(-1)).toMatchObject({ previousHash: insertedRows[0]?.hash });
  });
});
