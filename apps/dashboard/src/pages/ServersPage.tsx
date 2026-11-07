import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/StatTile';
import { useCreateServer, useDeleteServer, useResyncServer, useServers } from '../hooks/useServers';

// Material Symbols has no brand/logo glyphs (it's a generic icon set, not
// company logos), so this picks a semantically-fitting icon from the
// server's name/URL rather than a literal brand mark — best-effort, falls
// back to a plain server icon for anything unrecognized.
const ICON_RULES: Array<{ match: RegExp; icon: string; colorClass: string }> = [
  { match: /github/i, icon: 'code', colorClass: 'text-on-surface' },
  { match: /microsoft|learn\.microsoft/i, icon: 'menu_book', colorClass: 'text-secondary' },
  { match: /deepwiki|wiki/i, icon: 'auto_stories', colorClass: 'text-secondary' },
  { match: /drawio|diagram/i, icon: 'schema', colorClass: 'text-primary' },
  { match: /fetch|fetcher|web/i, icon: 'public', colorClass: 'text-secondary' },
  { match: /ip-address|ip\.app/i, icon: 'lan', colorClass: 'text-on-surface' },
  { match: /qr/i, icon: 'qr_code_2', colorClass: 'text-on-surface' },
  { match: /faostat|agri/i, icon: 'agriculture', colorClass: 'text-tertiary' },
  { match: /filings|sec/i, icon: 'account_balance', colorClass: 'text-tertiary' },
  { match: /trade|tradetime|market/i, icon: 'show_chart', colorClass: 'text-tertiary' },
  { match: /growo|growth/i, icon: 'trending_up', colorClass: 'text-primary' },
  { match: /fixture|localhost|127\.0\.0\.1/i, icon: 'science', colorClass: 'text-on-surface-variant' },
  { match: /slack/i, icon: 'forum', colorClass: 'text-secondary' },
  { match: /jira|ticket/i, icon: 'task_alt', colorClass: 'text-primary' },
  { match: /database|postgres|sql/i, icon: 'database', colorClass: 'text-tertiary' },
  { match: /aws|cloud/i, icon: 'cloud', colorClass: 'text-secondary' },
  { match: /calendar/i, icon: 'calendar_month', colorClass: 'text-primary' },
  { match: /email|mail/i, icon: 'mail', colorClass: 'text-secondary' },
  { match: /weather/i, icon: 'partly_cloudy_day', colorClass: 'text-tertiary' },
];

function iconForServer(name: string, url: string): { icon: string; colorClass: string } {
  const haystack = `${name} ${url}`;
  const rule = ICON_RULES.find((r) => r.match.test(haystack));
  return rule ?? { icon: 'dns', colorClass: 'text-primary' };
}

export function ServersPage() {
  const { data: serverList, isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const resyncServer = useResyncServer();
  const [resyncMessages, setResyncMessages] = useState<Record<string, string>>({});
  const [resyncingAll, setResyncingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleResync(id: string) {
    setResyncMessages((prev) => ({ ...prev, [id]: '' }));
    try {
      const result = await resyncServer.mutateAsync(id);
      setResyncMessages((prev) => ({ ...prev, [id]: `Indexed ${result.toolCount} tool(s).` }));
    } catch (err) {
      setResyncMessages((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Resync failed',
      }));
    }
  }

  async function handleResyncAll() {
    if (!serverList) return;
    setResyncingAll(true);
    try {
      await Promise.all(serverList.map((server) => handleResync(server.id)));
    } finally {
      setResyncingAll(false);
    }
  }

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [tokenEnv, setTokenEnv] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createServer.mutateAsync({
        name,
        url,
        auth: authType === 'bearer' ? { type: 'bearer', tokenEnv } : { type: 'none' },
        enabledTools: [],
      });
      setName('');
      setUrl('');
      setAuthType('none');
      setTokenEnv('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    }
  }

  const bearerCount = serverList?.filter((s) => s.auth.type === 'bearer').length ?? 0;
  const noneCount = serverList?.filter((s) => s.auth.type === 'none').length ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-xl px-gutter-md py-space-lg">
      <div className="flex flex-col gap-space-base sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-space-xxs flex items-center gap-space-xs text-[11px] uppercase tracking-wider text-on-surface-variant">
            <span>Gateway Configuration</span>
            <span>/</span>
            <span className="font-semibold text-primary">Connected Servers</span>
          </div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
            Connected MCP Servers
          </h1>
          <p className="mt-space-xxs text-sm text-on-surface-variant">
            Downstream tool servers exposed to AI agents through the AdaptiveGate gateway.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={handleResyncAll}
            disabled={resyncingAll || !serverList || serverList.length === 0}
            className="flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-md py-space-xs text-sm font-medium text-on-surface shadow-sm transition-all hover:bg-surface-container-low disabled:opacity-50"
          >
            <Icon name="sync" className={`text-[18px] ${resyncingAll ? 'animate-spin' : ''}`} />
            Resync all
          </button>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="flex items-center gap-space-xs rounded-lg bg-primary px-space-base py-space-xs text-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary-container"
          >
            <Icon name="add" className="text-[18px]" />
            {showForm ? 'Cancel' : 'Add MCP server'}
          </button>
        </div>
      </div>

      {serverList && serverList.length > 0 && (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-3">
          <StatTile label="Connected servers" value={serverList.length} icon="dns" iconColorClass="text-primary" />
          <StatTile label="Bearer-token auth" value={bearerCount} icon="key" iconColorClass="text-secondary" />
          <StatTile label="No auth configured" value={noneCount} icon="lock_open" iconColorClass="text-tertiary" />
        </div>
      )}

      {showForm && (
        <Card className="shadow-md">
          <div className="mb-space-base flex items-center gap-space-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary">
              <Icon name="add_link" className="text-[20px]" />
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-on-surface">Register MCP server</h2>
              <p className="text-sm text-on-surface-variant">
                Remote HTTP/SSE servers only — hosted mode never executes stdio commands.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-space-base">
            <div className="grid grid-cols-1 gap-space-base md:grid-cols-2">
              <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
                Server name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. github-mcp"
                  className="rounded-lg bg-surface-container-low px-space-md py-space-sm font-mono text-sm text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </label>
              <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
                Auth
                <select
                  value={authType}
                  onChange={(event) => setAuthType(event.target.value as 'none' | 'bearer')}
                  className="rounded-lg bg-surface-container-low px-space-md py-space-sm text-sm text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
              Endpoint URL
              <div className="relative">
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  type="url"
                  placeholder="https://example.com/mcp"
                  className="w-full rounded-lg bg-surface-container-low px-space-md py-space-sm pr-space-2xl font-mono text-sm text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <Icon name="hub" className="absolute right-space-sm top-2.5 text-[18px] text-on-surface-variant" />
              </div>
            </label>
            {authType === 'bearer' && (
              <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-base">
                <div className="flex items-center gap-space-xs">
                  <Icon name="key" className="text-[18px] text-primary" />
                  <span className="text-sm font-semibold text-on-surface">Authentication</span>
                </div>
                <label className="flex flex-col gap-space-xs text-sm text-on-surface-variant">
                  Token env var name
                  <input
                    value={tokenEnv}
                    onChange={(event) => setTokenEnv(event.target.value)}
                    placeholder="GITHUB_MCP_TOKEN"
                    className="rounded-lg bg-surface-container-lowest px-space-md py-space-xs font-mono text-sm text-on-surface shadow-sm focus:outline-none"
                    required
                  />
                </label>
                <span className="text-xs text-on-surface-variant">
                  The actual token must already be set as this env var on the gateway server —
                  it&apos;s never sent to or stored by the dashboard.
                </span>
              </div>
            )}
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createServer.isPending}
                className="flex items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs text-sm font-medium text-on-primary shadow-sm transition-all disabled:opacity-50"
              >
                <Icon name="check" className="text-[18px]" />
                {createServer.isPending ? 'Saving…' : 'Save server'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-space-base">
        <div className="flex items-center gap-space-sm px-space-xs">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">Provisioned nodes</h2>
          {serverList && (
            <span className="rounded-full bg-surface-container-high px-space-xs py-0.5 font-mono text-[11px] text-on-surface-variant">
              {serverList.length} registered
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : serverList && serverList.length > 0 ? (
          serverList.map((server) => {
            const { icon, colorClass } = iconForServer(server.name, server.url);
            return (
            <Card key={server.id} className="flex flex-col gap-space-md !p-space-lg">
              <div className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-space-md">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low ${colorClass}`}>
                    <Icon name={icon} className="text-[24px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-space-sm">
                      <h3 className="font-sans text-base font-semibold text-on-surface">{server.name}</h3>
                      <span className="flex items-center gap-1 rounded-full bg-surface-container-high px-space-xs py-0.5 text-[11px] font-medium text-on-surface-variant">
                        Registered
                      </span>
                    </div>
                    <div className="mt-space-xxs flex items-center gap-space-sm font-mono text-xs text-on-surface-variant">
                      <span className="rounded-lg bg-surface-container-low px-space-xs py-0.5 font-medium text-on-surface">
                        {server.auth.type === 'bearer' ? 'Bearer token' : 'No auth'}
                      </span>
                      <span>·</span>
                      <span className="select-all">{server.url}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-space-xs self-end md:self-auto">
                  <button
                    type="button"
                    onClick={() => handleResync(server.id)}
                    disabled={resyncServer.isPending}
                    className="flex items-center gap-space-xxs rounded-lg p-space-xs text-sm text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
                  >
                    <Icon name="refresh" className="text-[16px]" />
                    Resync
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteServer.mutate(server.id)}
                    className="rounded-lg p-space-xs text-outline transition-colors hover:bg-error-container hover:text-error"
                    title="Remove server"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-space-sm border-t border-outline-variant/30 pt-space-sm text-xs text-on-surface-variant">
                {resyncMessages[server.id] && <span>{resyncMessages[server.id]}</span>}
                <span className="font-mono text-outline">id: {server.id}</span>
              </div>
            </Card>
            );
          })
        ) : (
          <p className="text-on-surface-variant">No servers yet.</p>
        )}
      </div>
    </div>
  );
}
