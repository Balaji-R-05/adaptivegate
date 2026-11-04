import { beforeEach, describe, expect, it, vi } from 'vitest';

const policiesTable = { userId: 'userId', createdAt: 'createdAt', yaml: 'yaml' };

let policyRows: Array<{ yaml: string }> = [];

vi.mock('@adaptivegate/db', () => ({
  policies: policiesTable,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(policyRows),
          }),
        }),
      }),
    }),
  },
}));

const { evaluateCallToolPolicy } = await import('./policyEngine');

describe('evaluateCallToolPolicy', () => {
  beforeEach(() => {
    policyRows = [];
  });

  it('denies when the user has no policy configured at all', async () => {
    const verdict = await evaluateCallToolPolicy('user-1', 'github.create_issue');
    expect(verdict.action).toBe('deny');
  });

  it('denies (fail-closed) when the stored policy is not valid YAML/schema', async () => {
    policyRows = [{ yaml: 'not: [valid' }];
    const verdict = await evaluateCallToolPolicy('user-1', 'github.create_issue');
    expect(verdict.action).toBe('deny');
  });

  it('allows when the policy allows the tool', async () => {
    policyRows = [
      {
        yaml: 'version: 1\nrules:\n  - name: allow-all\n    match: { tool: "*" }\n    action: allow\n',
      },
    ];
    const verdict = await evaluateCallToolPolicy('user-1', 'github.create_issue');
    expect(verdict).toEqual({ action: 'allow' });
  });

  it('denies when the policy denies that specific tool', async () => {
    policyRows = [
      {
        yaml: 'version: 1\nrules:\n  - name: no-deletes\n    match: { tool: "filesystem.delete_*" }\n    action: deny\n',
      },
    ];
    const verdict = await evaluateCallToolPolicy('user-1', 'filesystem.delete_file');
    expect(verdict.action).toBe('deny');
  });
});
