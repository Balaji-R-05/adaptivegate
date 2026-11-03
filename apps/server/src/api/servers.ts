import { db, servers } from '@adaptivegate/db';
import { createServerConfigInputSchema } from '@adaptivegate/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { assertSafeDownstreamUrl, UnsafeDownstreamUrlError } from '../guards/ssrf';

export const serversRouter = new Hono();

serversRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.select().from(servers).where(eq(servers.userId, userId));
  return c.json(rows);
});

serversRouter.post('/', async (c) => {
  const userId = c.get('userId');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = createServerConfigInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  try {
    await assertSafeDownstreamUrl(parsed.data.url);
  } catch (error) {
    if (error instanceof UnsafeDownstreamUrlError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }

  const [row] = await db
    .insert(servers)
    .values({ ...parsed.data, userId })
    .returning();

  return c.json(row, 201);
});

serversRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = createServerConfigInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }

  if (parsed.data.url) {
    try {
      await assertSafeDownstreamUrl(parsed.data.url);
    } catch (error) {
      if (error instanceof UnsafeDownstreamUrlError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  }

  // Scoping the WHERE by userId (not just id) is what stops one user from
  // editing another user's server — see CLAUDE.md's "scope every database
  // query by user ID" convention.
  const [row] = await db
    .update(servers)
    .set(parsed.data)
    .where(and(eq(servers.id, id), eq(servers.userId, userId)))
    .returning();

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(row);
});

serversRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db
    .delete(servers)
    .where(and(eq(servers.id, id), eq(servers.userId, userId)))
    .returning();

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.body(null, 204);
});
