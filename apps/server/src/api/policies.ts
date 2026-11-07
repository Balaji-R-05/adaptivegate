import { db, identities, policies } from '@adaptivegate/db';
import { parsePolicyDocument, PolicyParseError } from '@adaptivegate/governance';
import { createPolicyInputSchema, deletePolicyInputSchema } from '@adaptivegate/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

export const policiesRouter = new Hono();

policiesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.select().from(policies).where(eq(policies.userId, userId));
  return c.json(rows);
});

// No PATCH yet, and no named-policy selection — the engine just takes
// whichever policy a user created most recently (see
// src/governance/policyEngine.ts) unless an identity has one pinned.
policiesRouter.post('/', async (c) => {
  const userId = c.get('userId');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = createPolicyInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  try {
    parsePolicyDocument(parsed.data.yaml);
  } catch (error) {
    const message = error instanceof PolicyParseError ? error.message : 'invalid policy document';
    return c.json({ error: message }, 400);
  }

  const [row] = await db
    .insert(policies)
    .values({ ...parsed.data, userId, version: 1 })
    .returning();

  return c.json(row, 201);
});

policiesRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    // No body at all is fine here — reassignPolicyId is optional.
  }
  const parsed = deletePolicyInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }
  const reassignPolicyId = parsed.data.reassignPolicyId ?? null;

  if (reassignPolicyId) {
    if (reassignPolicyId === id) {
      return c.json({ error: 'cannot reassign identities to the policy being deleted' }, 400);
    }
    const [target] = await db
      .select({ id: policies.id })
      .from(policies)
      .where(and(eq(policies.id, reassignPolicyId), eq(policies.userId, userId)));
    if (!target) {
      return c.json({ error: 'reassignPolicyId does not exist or is not yours' }, 400);
    }
  }

  // Always repoint affected identities explicitly, rather than leaning on
  // identities.policyId's ON DELETE SET NULL foreign key — same outcome in
  // the "no reassignment" case, but keeps this endpoint's behavior fully
  // determined by application code (and testable against the fake DB) in
  // both branches, not split between app logic and an implicit DB cascade.
  await db
    .update(identities)
    .set({ policyId: reassignPolicyId })
    .where(and(eq(identities.policyId, id), eq(identities.userId, userId)))
    .returning({ id: identities.id });

  const [row] = await db
    .delete(policies)
    .where(and(eq(policies.id, id), eq(policies.userId, userId)))
    .returning({ id: policies.id });

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }

  return c.body(null, 204);
});
