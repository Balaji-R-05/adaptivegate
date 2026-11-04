import { db, policies } from '@adaptivegate/db';
import { parsePolicyDocument, PolicyParseError } from '@adaptivegate/governance';
import { createPolicyInputSchema } from '@adaptivegate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

export const policiesRouter = new Hono();

policiesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.select().from(policies).where(eq(policies.userId, userId));
  return c.json(rows);
});

// No PATCH/DELETE yet, and no named-policy selection — the engine just
// takes whichever policy a user created most recently (see
// src/governance/policyEngine.ts). Minimal on purpose: there's no
// dashboard Policies page yet, this just needs to exist so a policy can be
// configured at all before that UI lands.
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
