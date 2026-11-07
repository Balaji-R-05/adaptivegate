const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
export const GATEWAY_MCP_URL = `${GATEWAY_URL}/mcp`;

export type SnippetTab = 'claude' | 'curl';

// Deliberately one line, no `\` line continuation — `\` only continues a
// line in bash/zsh. PowerShell (Windows' default terminal) uses a backtick
// for that, so a multi-line bash-style snippet silently runs the first line
// alone (no --header) and errors on the rest, which is exactly how a real
// user's `claude mcp add` ended up missing its auth header. A single line
// works unmodified in every shell. Shared by ConnectPage (unscoped keys)
// and IdentitiesPage (identity-scoped keys) — same gateway, same auth
// scheme, only the key differs.
export function connectSnippet(tab: SnippetTab, key: string): string {
  if (tab === 'claude') {
    return `claude mcp add --transport http adaptivegate ${GATEWAY_MCP_URL} --header "Authorization: Bearer ${key}"`;
  }
  // Single-quoted JSON body: PowerShell passes a single-quoted string to an
  // external command literally (same as bash), so this works unmodified in
  // both — unlike a double-quoted body with escaped inner quotes, which
  // PowerShell does NOT unescape the way bash does.
  return `curl -X POST ${GATEWAY_MCP_URL} -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
