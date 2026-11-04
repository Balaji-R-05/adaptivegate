import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from './evaluate';
import type { PolicyDocument } from './schema';

describe('evaluatePolicy', () => {
  it('allows when no rule matches', () => {
    const doc: PolicyDocument = { version: 1, rules: [] };
    expect(evaluatePolicy(doc, { tool: 'anything' })).toEqual({ action: 'allow' });
  });

  it('denies when a deny rule matches', () => {
    const doc: PolicyDocument = {
      version: 1,
      rules: [{ name: 'no-deletes', match: { tool: 'filesystem.delete_*' }, action: 'deny' }],
    };
    const verdict = evaluatePolicy(doc, { tool: 'filesystem.delete_file' });
    expect(verdict.action).toBe('deny');
    expect(verdict).toMatchObject({ ruleName: 'no-deletes' });
  });

  it('requires approval when a require_approval rule matches', () => {
    const doc: PolicyDocument = {
      version: 1,
      rules: [
        { name: 'approve-writes', match: { tool: 'github.create_*' }, action: 'require_approval' },
      ],
    };
    const verdict = evaluatePolicy(doc, { tool: 'github.create_issue' });
    expect(verdict.action).toBe('require_approval');
  });

  it('uses the first matching rule, not the most specific one', () => {
    const doc: PolicyDocument = {
      version: 1,
      rules: [
        { name: 'allow-all', match: { tool: '*' }, action: 'allow' },
        { name: 'deny-deletes', match: { tool: 'filesystem.delete_*' }, action: 'deny' },
      ],
    };
    const verdict = evaluatePolicy(doc, { tool: 'filesystem.delete_file' });
    expect(verdict).toEqual({ action: 'allow' });
  });
});
