import { describe, expect, it } from 'vitest';
import type { PolicyDocument } from '../policy/schema';
import { buildReplayScorecard, type ReplayLogEntry } from './scorecard';

const ALLOW_ALL: PolicyDocument = { version: 1, rules: [] };

describe('buildReplayScorecard', () => {
  it('counts every entry as allowed under a policy with no rules', () => {
    const entries: ReplayLogEntry[] = [{ tool: 'a' }, { tool: 'b' }, { tool: 'c' }];
    const scorecard = buildReplayScorecard(entries, ALLOW_ALL);
    expect(scorecard.totalEntries).toBe(3);
    expect(scorecard.byReplayedAction).toEqual({ allow: 3, deny: 0, require_approval: 0 });
    expect(scorecard.newlyBlocked).toEqual([]);
    expect(scorecard.newlyAllowed).toEqual([]);
  });

  it('flags entries that a stricter policy would newly block', () => {
    const stricter: PolicyDocument = {
      version: 1,
      rules: [{ name: 'no-deletes', match: { tool: 'filesystem.delete_*' }, action: 'deny' }],
    };
    const entries: ReplayLogEntry[] = [
      { tool: 'filesystem.delete_file', serverId: 's1', actualAction: 'allow' },
      { tool: 'filesystem.read_file', actualAction: 'allow' },
    ];
    const scorecard = buildReplayScorecard(entries, stricter);
    expect(scorecard.newlyBlocked).toHaveLength(1);
    expect(scorecard.newlyBlocked[0]).toMatchObject({
      tool: 'filesystem.delete_file',
      actualAction: 'allow',
      replayedAction: 'deny',
      changed: true,
    });
    expect(scorecard.newlyAllowed).toEqual([]);
  });

  it('flags entries that a looser policy would newly allow', () => {
    const looser: PolicyDocument = {
      version: 1,
      rules: [{ name: 'allow-all', match: { tool: '*' }, action: 'allow' }],
    };
    const entries: ReplayLogEntry[] = [
      { tool: 'filesystem.delete_file', actualAction: 'deny' },
      { tool: 'github.create_issue', actualAction: 'require_approval' },
    ];
    const scorecard = buildReplayScorecard(entries, looser);
    expect(scorecard.newlyAllowed).toHaveLength(2);
    expect(scorecard.newlyBlocked).toEqual([]);
  });

  it('reports action counts only, with no diff, when actualAction is unknown', () => {
    const stricter: PolicyDocument = {
      version: 1,
      rules: [{ name: 'no-deletes', match: { tool: 'filesystem.delete_*' }, action: 'deny' }],
    };
    const entries: ReplayLogEntry[] = [{ tool: 'filesystem.delete_file' }];
    const scorecard = buildReplayScorecard(entries, stricter);
    expect(scorecard.byReplayedAction.deny).toBe(1);
    expect(scorecard.results[0]?.changed).toBe(false);
    expect(scorecard.newlyBlocked).toEqual([]);
  });
});
