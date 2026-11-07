const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
export const GATEWAY_MCP_URL = `${GATEWAY_URL}/mcp`;

export type SnippetTab = 'claude' | 'codex' | 'curl';

// The env var name Codex's --bearer-token-env-var reads from — fixed, not
// derived from the key, so re-copying the snippet for a different key still
// matches whatever the user already exported once.
const CODEX_TOKEN_ENV_VAR = 'ADAPTIVEGATE_API_KEY';

// Deliberately one line (claude/curl), no `\` line continuation — `\` only
// continues a line in bash/zsh. PowerShell (Windows' default terminal) uses
// a backtick for that, so a multi-line bash-style snippet silently runs the
// first line alone (no --header) and errors on the rest, which is exactly
// how a real user's `claude mcp add` ended up missing its auth header. A
// single line works unmodified in every shell. Shared by ConnectPage
// (unscoped keys) and IdentitiesPage (identity-scoped keys) — same gateway,
// same auth scheme, only the key differs.
export function connectSnippet(tab: SnippetTab, key: string): string {
  if (tab === 'claude') {
    return `claude mcp add --transport http adaptivegate ${GATEWAY_MCP_URL} --header "Authorization: Bearer ${key}"`;
  }
  if (tab === 'codex') {
    // Codex CLI's `mcp add` has no equivalent of Claude's --header — it only
    // accepts --bearer-token-env-var, the NAME of an environment variable to
    // read the token from at connection time, never the raw token as a CLI
    // argument. So this is genuinely two commands, not a single-line
    // workaround: export the key (bash/zsh syntax, see the PowerShell note
    // below this snippet), then register the server referencing that name.
    return `export ${CODEX_TOKEN_ENV_VAR}="${key}"\ncodex mcp add adaptivegate --url ${GATEWAY_MCP_URL} --bearer-token-env-var ${CODEX_TOKEN_ENV_VAR}`;
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
