import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/StatTile';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApiKeys';
import { connectSnippet, copyText, GATEWAY_MCP_URL, type SnippetTab } from '../lib/connectSnippet';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

export function ConnectPage() {
  const { data: keys, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [label, setLabel] = useState('');
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [snippetTab, setSnippetTab] = useState<SnippetTab>('claude');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const result = await createKey.mutateAsync({ label });
    setJustCreatedKey(result.key);
    setLabel('');
  }

  async function handlePing() {
    setPinging(true);
    setPingResult(null);
    const start = performance.now();
    try {
      const res = await fetch(`${GATEWAY_URL}/health`);
      const ms = Math.round(performance.now() - start);
      setPingResult(res.ok ? `${res.status} OK (${ms}ms)` : `${res.status} (${ms}ms)`);
    } catch {
      setPingResult('unreachable');
    } finally {
      setPinging(false);
    }
  }

  const activeCount = keys?.filter((k) => !k.revokedAt).length ?? 0;
  const revokedCount = keys?.filter((k) => k.revokedAt).length ?? 0;
  const snippetKey = justCreatedKey ?? 'ag_xxxxx';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-xl px-gutter-md py-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-base">
        <div className="flex flex-col gap-space-xxs">
          <div className="flex items-center gap-space-xs text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span>Gateway Integration</span>
          </div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
            Connect AI Agents
          </h1>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Point any MCP client at the gateway endpoint below for routing, recovery, and governance
            on every tool call.
          </p>
        </div>
        <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-xs shadow-sm">
          <span className="flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-sm py-space-xs text-sm text-on-surface shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary-container" />
            {pingResult ? pingResult : 'Gateway configured'}
          </span>
          <button
            type="button"
            onClick={handlePing}
            disabled={pinging}
            className="flex items-center gap-space-xs rounded-lg bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
          >
            <Icon name="sync" className={`text-[16px] ${pinging ? 'animate-spin' : ''}`} />
            {pinging ? 'Pinging…' : 'Test Ping'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
        <Card className="flex flex-col justify-between !p-0">
          <div className="flex flex-col gap-space-sm p-space-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs font-sans text-base font-semibold text-on-surface">
                <Icon name="rss_feed" className="text-[20px] text-primary" />
                <h2>Gateway Endpoint (HTTP)</h2>
              </div>
              <span className="rounded bg-surface-container-high px-space-xs py-0.5 font-mono text-xs text-on-surface-variant">
                Streamable HTTP
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Pass this URL as the MCP server endpoint in your client configuration.
            </p>
            <div className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm shadow-inner">
              <span className="select-all truncate font-mono text-sm text-on-surface">
                {GATEWAY_MCP_URL}
              </span>
              <button
                type="button"
                onClick={() => {
                  void copyText(GATEWAY_MCP_URL);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2000);
                }}
                className="flex shrink-0 items-center gap-space-xxs rounded bg-surface-container-lowest px-space-sm py-space-xs text-xs font-medium text-on-surface shadow-sm transition-all hover:bg-surface-container active:scale-95"
              >
                <Icon name="content_copy" className="text-[16px]" />
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-b-xl bg-surface-container-low/50 p-space-md">
            <div className="flex items-center gap-space-xs text-[11px] text-on-surface-variant">
              <Icon name="verified_user" className="text-[16px] text-tertiary" />
              <span>API-key authenticated, SSRF-guarded downstream connections</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between !p-0">
          <div className="flex flex-col gap-space-sm p-space-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs font-sans text-base font-semibold text-on-surface">
                <Icon name="key" className="text-[20px] text-secondary" />
                <h2>Create an API Key</h2>
              </div>
              <span className="rounded bg-error-container px-space-xs py-0.5 text-xs font-semibold text-on-error-container">
                Unscoped
              </span>
            </div>
            <div className="flex items-start gap-space-xs rounded-lg bg-surface-container p-space-sm text-on-surface">
              <Icon name="warning" className="mt-0.5 shrink-0 text-[18px] text-primary" />
              <p className="text-sm leading-snug">
                Shown once, right after creation — it can&apos;t be retrieved again. For a
                budget/scope-limited key, create an{' '}
                <a href="/identities" className="font-medium text-primary underline">
                  identity
                </a>{' '}
                instead.
              </p>
            </div>
            <form onSubmit={handleCreate} className="flex items-end gap-space-sm">
              <label className="flex flex-1 flex-col gap-1 text-sm text-on-surface-variant">
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="laptop"
                  className="rounded border border-outline-variant px-space-sm py-space-xs"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={createKey.isPending}
                className="rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
              >
                {createKey.isPending ? 'Creating…' : 'Create'}
              </button>
            </form>
            {justCreatedKey && (
              <div className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm shadow-inner">
                <code className="select-all truncate font-mono text-sm text-on-surface">
                  {justCreatedKey}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText(justCreatedKey)}
                  className="flex shrink-0 items-center gap-space-xxs rounded bg-primary px-space-sm py-space-xs text-xs font-medium text-on-primary shadow-sm transition-all active:scale-95"
                >
                  <Icon name="content_copy" className="text-[16px]" />
                  Copy Key
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between rounded-b-xl bg-surface-container-low/50 p-space-md text-[11px] text-on-surface-variant">
            <span>{activeCount} active, {revokedCount} revoked</span>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-space-xs p-space-lg pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs font-sans text-lg font-semibold text-on-surface">
              <Icon name="terminal" className="text-[22px] text-primary" />
              <h2>Client Integration Snippets</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                void copyText(connectSnippet(snippetTab, snippetKey));
                setCopiedSnippet(true);
                setTimeout(() => setCopiedSnippet(false), 2000);
              }}
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-space-xs text-sm font-medium text-on-surface shadow-sm transition-all hover:bg-surface-container active:scale-95"
            >
              <Icon name="content_copy" className="text-[16px]" />
              {copiedSnippet ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-on-surface-variant">
            {justCreatedKey
              ? 'Pre-filled with the key you just created.'
              : 'Create a key above to have it filled in here automatically.'}
          </p>
          <div className="mt-space-sm flex items-center gap-space-xs overflow-x-auto pt-space-xs">
            {(['claude', 'codex', 'curl'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSnippetTab(tab)}
                className={`flex items-center gap-space-xs rounded-t-lg px-space-md py-space-sm text-sm transition-colors ${
                  snippetTab === tab
                    ? 'bg-inverse-surface text-inverse-on-surface'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon
                  name={tab === 'claude' ? 'smart_toy' : tab === 'codex' ? 'terminal' : 'code'}
                  className="text-[16px]"
                />
                {tab === 'claude' ? 'Claude Code CLI' : tab === 'codex' ? 'Codex CLI' : 'curl (generic MCP client)'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto bg-inverse-surface p-space-lg">
          <pre className="font-mono text-xs leading-relaxed text-inverse-on-surface">
            {connectSnippet(snippetTab, snippetKey)}
          </pre>
        </div>
        {snippetTab === 'curl' && (
          <p className="border-t border-outline-variant/30 bg-surface-container-low px-space-lg py-space-sm text-xs text-on-surface-variant">
            <strong className="text-on-surface">Windows PowerShell:</strong> <code>curl</code> is
            aliased to <code>Invoke-WebRequest</code> there, which parses <code>-H</code>{' '}
            differently and will fail. Run <code>curl.exe</code> instead of <code>curl</code> to
            use the real curl.
          </p>
        )}
        {snippetTab === 'codex' && (
          <p className="border-t border-outline-variant/30 bg-surface-container-low px-space-lg py-space-sm text-xs text-on-surface-variant">
            <strong className="text-on-surface">Windows PowerShell:</strong> replace the first line
            with <code>$env:ADAPTIVEGATE_API_KEY = "..."</code> — <code>export</code> is bash/zsh
            syntax and won't work there. Codex has no header option, only{' '}
            <code>--bearer-token-env-var</code>, so the key has to go through an environment
            variable rather than the command itself.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2">
        <StatTile label="Active keys" value={activeCount} icon="vpn_key" iconColorClass="text-tertiary" />
        <StatTile label="Revoked keys" value={revokedCount} icon="key_off" iconColorClass="text-error" />
      </div>

      <div className="flex flex-col gap-space-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">API Keys</h2>
        {isLoading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : keys && keys.length > 0 ? (
          <div className="flex flex-col gap-space-sm">
            {keys.map((key) => (
              <Card key={key.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-on-surface">{key.label}</p>
                  <p className="text-sm text-on-surface-variant">
                    {key.revokedAt ? 'Revoked' : 'Active'}
                  </p>
                </div>
                {!key.revokedAt && (
                  <button
                    type="button"
                    onClick={() => revokeKey.mutate(key.id)}
                    className="text-sm font-medium text-error"
                  >
                    Revoke
                  </button>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant">No API keys yet.</p>
        )}
      </div>
    </div>
  );
}
