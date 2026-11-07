import type { ServerAuth } from '@adaptivegate/shared';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connectDownstream } from './downstreamClient';

// A downstream MCP connection's handshake (connect()/initialize) is the
// expensive part of a round trip — see the MCP SDK's
// StreamableHTTPClientTransport, which obtains an mcp-session-id during
// that handshake and reuses it on every subsequent request. Closing the
// client after every single call_tool throws that session away and forces
// a fresh handshake next time, which is most of the 2-3s round trip the
// router evaluation measured. This pool keeps connections open across
// calls instead.
//
// Keyed by (serverId, url, auth.type) rather than serverId alone: the same
// serverId can legitimately point at a different URL over time (a real
// server edited via PATCH /api/servers/:id, or — the case that actually
// forced this design — route.test.ts's fixtures reusing the same mocked
// serverId across different test cases with different fixture URLs). Keying
// on the resolved URL too makes the pool self-correcting whenever the
// target actually changes, without relying on every call site remembering
// to evict.
const pool = new Map<string, Promise<Client>>();

function poolKey(serverId: string, url: string, auth: ServerAuth): string {
  return `${serverId}|${url}|${auth.type}`;
}

// Stores a Promise, not a resolved Client, so concurrent call_tool
// invocations racing to connect to the same server for the first time all
// await the same in-flight connect instead of opening two connections (one
// of which would otherwise leak, never closed).
export function getPooledConnection(
  serverId: string,
  url: string,
  auth: ServerAuth,
): Promise<Client> {
  const key = poolKey(serverId, url, auth);
  let pending = pool.get(key);
  if (!pending) {
    pending = connectDownstream(url, auth);
    pool.set(key, pending);
    // A failed connect must not poison future calls — remove it so the
    // next getPooledConnection tries again fresh.
    pending.catch(() => pool.delete(key));
  }
  return pending;
}

export async function evictConnection(
  serverId: string,
  url: string,
  auth: ServerAuth,
): Promise<void> {
  const key = poolKey(serverId, url, auth);
  const pending = pool.get(key);
  pool.delete(key);
  if (!pending) return;
  try {
    const client = await pending;
    await client.close();
  } catch {
    // Already broken or already closed — nothing left to clean up.
  }
}
