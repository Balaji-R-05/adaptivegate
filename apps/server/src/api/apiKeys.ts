import { randomBytes } from 'node:crypto';
import { apiKeys, db } from '@adaptivegate/db';
import { createApiKeyInputSchema } from '@adaptivegate/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { hashApiKey } from '../auth/apiKey';

export const apiKeysRouter = new Hono();

apiKeysRouter.get('/', async (c) => {
  const userId = c.get('userId');
  // Metadata only — the hash (and definitely not a raw key) never comes back
  // from this endpoint.
  const rows = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  return c.json(rows);
});

apiKeysRouter.post('/', async (c) => {
  const userId = c.get('userId');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = createApiKeyInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  const rawKey = `ag_${randomBytes(24).toString('hex')}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, label: parsed.data.label, hashedKey: hashApiKey(rawKey) })
    .returning({ id: apiKeys.id, label: apiKeys.label, createdAt: apiKeys.createdAt });

  // Shown once, never fetched again — this response is the only place the
  // raw key ever appears.
  return c.json({ ...row, key: rawKey }, 201);
});

apiKeysRouter.post('/:id/revoke', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.body(null, 204);
});
