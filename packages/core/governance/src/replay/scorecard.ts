import { evaluatePolicy } from '../policy/evaluate';
import type { PolicyAction, PolicyDocument } from '../policy/schema';

// One historical call to re-evaluate under a candidate policy. `actualAction`
// is optional because a hand-written log (not exported from this project's
// own audit trail) may not know what really happened — the scorecard still
// reports the action distribution, just without a before/after diff.
export interface ReplayLogEntry {
  tool: string;
  serverId?: string;
  actualAction?: PolicyAction;
}

export interface ReplayEntryResult {
  tool: string;
  serverId?: string;
  actualAction?: PolicyAction;
  replayedAction: PolicyAction;
  changed: boolean;
}

export interface ReplayScorecard {
  totalEntries: number;
  byReplayedAction: Record<PolicyAction, number>;
  // Only populated for entries that recorded a real actualAction.
  newlyBlocked: ReplayEntryResult[];
  newlyAllowed: ReplayEntryResult[];
  results: ReplayEntryResult[];
}

const ALL_ACTIONS: PolicyAction[] = ['allow', 'deny', 'require_approval'];

// Pure and deterministic, like evaluatePolicy itself — just runs it over a
// list and diffs against each entry's recorded actualAction, instead of a
// single live call. No DB, no I/O; callers decide where the log came from.
export function buildReplayScorecard(
  entries: ReplayLogEntry[],
  document: PolicyDocument,
): ReplayScorecard {
  const byReplayedAction = Object.fromEntries(ALL_ACTIONS.map((action) => [action, 0])) as Record<
    PolicyAction,
    number
  >;

  const results: ReplayEntryResult[] = entries.map((entry) => {
    const verdict = evaluatePolicy(document, { tool: entry.tool });
    byReplayedAction[verdict.action] += 1;
    const changed = entry.actualAction !== undefined && entry.actualAction !== verdict.action;
    return {
      tool: entry.tool,
      serverId: entry.serverId,
      actualAction: entry.actualAction,
      replayedAction: verdict.action,
      changed,
    };
  });

  const newlyBlocked = results.filter(
    (r) => r.changed && r.actualAction === 'allow' && r.replayedAction !== 'allow',
  );
  const newlyAllowed = results.filter(
    (r) => r.changed && r.actualAction !== 'allow' && r.actualAction !== undefined && r.replayedAction === 'allow',
  );

  return { totalEntries: entries.length, byReplayedAction, newlyBlocked, newlyAllowed, results };
}
