import { db, servers } from '@adaptivegate/db';
import { createServerConfigInputSchema } from '@adaptivegate/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { assertSafeDownstreamUrl, UnsafeDownstreamUrlError } from '../guards/ssrf';
import { syncToolsForServer } from '../router/registry';

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

  if (!row) {
    return c.json({ error: 'failed to create server' }, 500);
  }

  // Index the new server's tools right away so search_tools can find them
  // immediately. Best-effort: the server config is still created even if
  // this fails (e.g. the downstream server is briefly unreachable) — the
  // resync endpoint below lets the user retry.
  let syncError: string | undefined;
  try {
    await syncToolsForServer({ id: row.id, userId, url: row.url });
  } catch (error) {
    syncError = error instanceof Error ? error.message : 'failed to index tools';
  }

  return c.json(syncError ? { ...row, syncError } : row, 201);
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

serversRouter.post('/:id/resync', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, id), eq(servers.userId, userId)));

  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }

  try {
    const toolCount = await syncToolsForServer({ id: row.id, userId, url: row.url });
    return c.json({ toolCount });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'resync failed' }, 502);
  }
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
