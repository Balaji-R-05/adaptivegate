import { randomBytes } from 'node:crypto';
import { apiKeys, db, identities } from '@adaptivegate/db';
import { createIdentityInputSchema, updateIdentityInputSchema } from '@adaptivegate/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { hashApiKey } from '../auth/apiKey';

export const identitiesRouter = new Hono();

identitiesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.select().from(identities).where(eq(identities.userId, userId));
  return c.json(rows);
});

// Creating an identity also mints its one API key inline — a scoped/budgeted
// identity is useless without a key that carries that scope, so there's no
// separate "create a key for this identity" step (unlike the plain, unscoped
// keys on the Connect page).
identitiesRouter.post('/', async (c) => {
  const userId = c.get('userId');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = createIdentityInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  const [identity] = await db.insert(identities).values({ ...parsed.data, userId }).returning();
  if (!identity) {
    return c.json({ error: 'failed to create identity' }, 500);
  }

  const rawKey = `ag_${randomBytes(24).toString('hex')}`;
  await db
    .insert(apiKeys)
    .values({
      userId,
      identityId: identity.id,
      label: `${identity.name} (identity key)`,
      hashedKey: hashApiKey(rawKey),
    })
    .returning();

  // Shown once, never fetched again — same convention as /api/keys.
  return c.json({ ...identity, key: rawKey }, 201);
});

identitiesRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = updateIdentityInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  const [row] = await db
    .update(identities)
    .set(parsed.data)
    .where(and(eq(identities.id, id), eq(identities.userId, userId)))
    .returning();

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(row);
});

identitiesRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db
    .delete(identities)
    .where(and(eq(identities.id, id), eq(identities.userId, userId)))
    .returning();

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.body(null, 204);
});
