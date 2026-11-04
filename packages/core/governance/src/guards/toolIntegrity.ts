import { canonicalStringify } from '../audit/canonicalJson';

export interface ToolDefinition {
  description: string;
  inputSchema: unknown;
}

// The "rug-pull" check: a server that silently changes an already-indexed
// tool's behavior after it's been approved/connected. Detection only for
// now — doesn't block a sync, just signals it (see
// apps/server/src/router/registry.ts); there's no dashboard review UI yet
// for this to feed into.
//
// Uses canonicalStringify (same as the audit hash chain), not plain
// JSON.stringify — `previous.inputSchema` typically comes back from
// Postgres's jsonb column, which reorders object keys, so a naive
// stringify comparison would report a false "changed" on every single
// re-sync even when nothing actually changed.
export function hasToolDefinitionChanged(previous: ToolDefinition, next: ToolDefinition): boolean {
  if (previous.description !== next.description) {
    return true;
  }
  return canonicalStringify(previous.inputSchema) !== canonicalStringify(next.inputSchema);
}
