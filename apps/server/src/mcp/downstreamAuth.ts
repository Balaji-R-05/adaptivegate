import type { ServerAuth } from '@adaptivegate/shared';

// Resolves a server's configured auth into request headers. `tokenEnv` names
// an env var on this process — the raw token is never stored in the
// database, only the name of where to find it (CLAUDE.md: never return
// downstream credentials to the browser; this keeps them out of the DB too).
export function resolveDownstreamHeaders(auth: ServerAuth): Record<string, string> {
  if (auth.type === 'none') {
    return {};
  }

  const token = process.env[auth.tokenEnv];
  if (!token) {
    throw new Error(`downstream auth env var "${auth.tokenEnv}" is not set`);
  }

  return { Authorization: `Bearer ${token}` };
}
