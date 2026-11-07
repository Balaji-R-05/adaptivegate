import { z } from 'zod';

// Mirrors @adaptivegate/governance's PolicyAction — duplicated rather than
// imported because packages/shared is the dependency-free base package that
// packages/core/governance itself depends on (see packages/shared/package.json).
const replayActionSchema = z.enum(['allow', 'deny', 'require_approval']);

// One line of a replay session log (apps/server/scripts/replay.ts's --log
// file) — validates untrusted JSONL before it reaches the pure replay logic
// in @adaptivegate/governance's replay module.
export const replayLogEntrySchema = z.object({
  tool: z.string().min(1),
  serverId: z.string().min(1).optional(),
  actualAction: replayActionSchema.optional(),
});

export type ReplayLogEntry = z.infer<typeof replayLogEntrySchema>;
