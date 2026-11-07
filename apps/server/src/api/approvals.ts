import { approvals, db } from '@adaptivegate/db';
import { isApprovalExpired } from '@adaptivegate/governance';
import { resolveApprovalInputSchema } from '@adaptivegate/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { recordEvent } from '../governance/auditLog';

export const approvalsRouter = new Hono();

// Pending + recently resolved, newest first. `isExpired` is computed here
// (packages/core/governance's isApprovalExpired), not stored — see
// packages/db's `approvals` table comment.
approvalsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.userId, userId))
    .orderBy(desc(approvals.createdAt));

  const now = new Date();
  return c.json(
    rows.map((row) => ({ ...row, isExpired: row.status === 'pending' && isApprovalExpired(row.expiresAt, now) })),
  );
});

approvalsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = resolveApprovalInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)));

  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }
  // Fail-closed: no re-resolving an already-decided or expired approval —
  // a stale "approve" click must not silently unblock a call days later.
  if (existing.status !== 'pending') {
    return c.json({ error: `already ${existing.status}` }, 409);
  }
  if (isApprovalExpired(existing.expiresAt, new Date())) {
    return c.json({ error: 'approval has expired' }, 409);
  }

  const [row] = await db
    .update(approvals)
    .set({ status: parsed.data.decision, decidedAt: new Date() })
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
    .returning();

  await recordEvent({
    userId,
    type: 'approval_decision',
    payload: {
      approvalId: id,
      tool: existing.tool,
      serverId: existing.serverId,
      identityId: existing.identityId,
      decision: parsed.data.decision,
    },
  });

  return c.json(row);
});
