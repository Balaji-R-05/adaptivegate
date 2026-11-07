/**
 * Exports a real user's own `policy_decision` audit events as a replay
 * session log — the JSONL input `scripts/replay.ts` (and the root `pnpm
 * replay` command) expects, so a candidate policy can be dry-run against
 * real historical traffic instead of a hand-written fixture.
 *
 * Usage: pnpm --filter @adaptivegate/server run export-log -- <email> [outFile] [limit]
 */
import { writeFileSync } from 'node:fs';
import { db, events, users } from '@adaptivegate/db';
import type { ReplayLogEntry } from '@adaptivegate/shared';
import { and, desc, eq } from 'drizzle-orm';

interface PolicyDecisionPayload {
  tool: string;
  serverId: string;
  verdict: { action: 'allow' | 'deny' | 'require_approval' };
}

function isPolicyDecisionPayload(payload: unknown): payload is PolicyDecisionPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.tool === 'string' &&
    typeof p.serverId === 'string' &&
    !!p.verdict &&
    typeof (p.verdict as Record<string, unknown>).action === 'string'
  );
}

async function main() {
  const [email, outFile = 'session.jsonl', limitArg] = process.argv.slice(2);

  if (!email) {
    console.error(
      'Usage: pnpm --filter @adaptivegate/server run export-log -- <email> [outFile] [limit]',
    );
    process.exit(1);
  }
  const limit = limitArg ? Number(limitArg) : 500;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }

  const rows = await db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.userId, user.id), eq(events.type, 'policy_decision')))
    .orderBy(desc(events.createdAt))
    .limit(limit);

  const lines: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isPolicyDecisionPayload(row.payload)) {
      skipped += 1;
      continue;
    }
    const entry: ReplayLogEntry = {
      tool: row.payload.tool,
      serverId: row.payload.serverId,
      actualAction: row.payload.verdict.action,
    };
    lines.push(JSON.stringify(entry));
  }

  writeFileSync(outFile, lines.join('\n') + (lines.length > 0 ? '\n' : ''));
  console.log(`Wrote ${lines.length} real policy_decision events to ${outFile} (${skipped} skipped — unexpected payload shape).`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
