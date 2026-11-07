/**
 * Dry-runs a candidate policy YAML against a JSONL session log of past
 * tool calls, without touching any real downstream server or database —
 * CLAUDE.md's build-order step 11 and documented `pnpm replay` command.
 *
 * Usage: pnpm replay --log <path.jsonl> --policy <path.yaml>
 *
 * The log is typically produced by `scripts/exportSessionLog.ts` from this
 * project's own real audit trail (each line has a real `actualAction`, so
 * the scorecard can show what the candidate policy would change), but any
 * JSONL file of `{tool, serverId?, actualAction?}` lines works.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { buildReplayScorecard, parsePolicyDocument, PolicyParseError } from '@adaptivegate/governance';
import { replayLogEntrySchema } from '@adaptivegate/shared';

function parseArgs(argv: string[]): { log?: string; policy?: string } {
  const result: { log?: string; policy?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--log') result.log = argv[++i];
    else if (argv[i] === '--policy') result.policy = argv[++i];
  }
  return result;
}

// The root `pnpm replay` command (package.json) runs this script via
// `pnpm --filter`, whose cwd is this package's directory, not wherever the
// user actually ran the command from — so a relative --log/--policy path
// typed at the repo root (matching CLAUDE.md's documented example) would
// otherwise resolve against the wrong directory. INIT_CWD is pnpm's own
// record of that original directory; tsx run directly (no pnpm filter)
// won't set it, so fall back to the real cwd.
function resolveFromInvocationDir(path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function loadLogEntries(path: string) {
  const lines = readFileSync(path, 'utf-8').split('\n').filter((line) => line.trim().length > 0);
  const entries = [];
  let skipped = 0;
  for (const line of lines) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    const parsed = replayLogEntrySchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    entries.push(parsed.data);
  }
  return { entries, skipped };
}

async function main() {
  const { log, policy } = parseArgs(process.argv.slice(2));
  if (!log || !policy) {
    console.error('Usage: pnpm replay --log <path.jsonl> --policy <path.yaml>');
    process.exit(1);
  }

  const logPath = resolveFromInvocationDir(log);
  const policyPath = resolveFromInvocationDir(policy);

  const { entries, skipped } = loadLogEntries(logPath);
  if (skipped > 0) {
    console.warn(`Skipped ${skipped} invalid line(s) in ${log}.`);
  }

  let document;
  try {
    document = parsePolicyDocument(readFileSync(policyPath, 'utf-8'));
  } catch (error) {
    console.error(error instanceof PolicyParseError ? error.message : error);
    process.exit(1);
  }

  const scorecard = buildReplayScorecard(entries, document);

  console.log(`\n=== Replay scorecard: ${entries.length} entries from ${log} against ${policy} ===`);
  console.table([
    { metric: 'total entries', value: scorecard.totalEntries },
    { metric: 'would allow', value: scorecard.byReplayedAction.allow },
    { metric: 'would deny', value: scorecard.byReplayedAction.deny },
    { metric: 'would require approval', value: scorecard.byReplayedAction.require_approval },
    { metric: 'newly blocked vs. what really happened', value: scorecard.newlyBlocked.length },
    { metric: 'newly allowed vs. what really happened', value: scorecard.newlyAllowed.length },
  ]);

  if (scorecard.newlyBlocked.length > 0) {
    console.log('\nCalls that were allowed for real but this policy would now block/require approval:');
    console.table(scorecard.newlyBlocked.map((r) => ({ tool: r.tool, serverId: r.serverId, replayedAction: r.replayedAction })));
  }
  if (scorecard.newlyAllowed.length > 0) {
    console.log('\nCalls that were blocked for real but this policy would now allow:');
    console.table(scorecard.newlyAllowed.map((r) => ({ tool: r.tool, serverId: r.serverId, actualAction: r.actualAction })));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
