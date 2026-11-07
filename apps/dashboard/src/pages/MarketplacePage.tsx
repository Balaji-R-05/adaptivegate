import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { MCP_CATALOG, type CatalogEntry } from '../data/mcpCatalog';
import { useCreateServer, useServers } from '../hooks/useServers';
import { iconForServer } from '../lib/serverIcon';

type AuthFilter = 'all' | 'free' | 'auth';

function MarketplaceCard({
  entry,
  connected,
}: {
  entry: CatalogEntry;
  connected: boolean;
}) {
  const createServer = useCreateServer();
  const { icon, colorClass } = iconForServer(entry.name, entry.url);
  const needsAuth = entry.auth.type === 'bearer';

  const [showAuthForm, setShowAuthForm] = useState(false);
  const [tokenEnv, setTokenEnv] = useState(
    entry.auth.type === 'bearer' ? entry.auth.tokenEnvPlaceholder : '',
  );
  const [error, setError] = useState<string | null>(null);

  async function addFree() {
    setError(null);
    try {
      await createServer.mutateAsync({ name: entry.name, url: entry.url, auth: { type: 'none' }, enabledTools: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    }
  }

  async function addWithAuth() {
    setError(null);
    try {
      await createServer.mutateAsync({
        name: entry.name,
        url: entry.url,
        auth: { type: 'bearer', tokenEnv },
        enabledTools: [],
      });
      setShowAuthForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    }
  }

  return (
    <Card className="flex flex-col gap-space-md">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex items-center gap-space-md">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low ${colorClass}`}>
            <Icon name={icon} className="text-[24px]" />
          </div>
          <div>
            <h3 className="font-sans text-base font-semibold text-on-surface">{entry.name}</h3>
            <span className="rounded-lg bg-surface-container-high px-space-xs py-0.5 text-[11px] font-medium text-on-surface-variant">
              {entry.category}
            </span>
          </div>
        </div>
        <StatusPill variant={needsAuth ? 'pending' : 'allowed'}>
          {needsAuth ? 'Auth required' : 'Free'}
        </StatusPill>
      </div>

      <p className="text-sm text-on-surface-variant">{entry.description}</p>
      <p className="truncate font-mono text-xs text-outline">{entry.url}</p>

      {error && <p className="text-sm text-error">{error}</p>}

      {connected ? (
        <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-space-sm text-sm text-on-surface-variant">
          <Icon name="check_circle" className="text-[18px] text-tertiary" />
          Connected
        </div>
      ) : needsAuth && showAuthForm ? (
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-base">
          <label className="flex flex-col gap-space-xs text-sm text-on-surface-variant">
            Token env var name
            <input
              value={tokenEnv}
              onChange={(event) => setTokenEnv(event.target.value)}
              className="rounded-lg bg-surface-container-lowest px-space-md py-space-xs font-mono text-sm text-on-surface shadow-sm focus:outline-none"
              required
            />
          </label>
          <span className="text-xs text-on-surface-variant">
            The actual token must already be set as this env var on the gateway server — it&apos;s
            never sent to or stored by the dashboard.
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              onClick={() => void addWithAuth()}
              disabled={createServer.isPending || !tokenEnv}
              className="flex items-center gap-space-xs rounded-lg bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
            >
              {createServer.isPending ? 'Adding…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setShowAuthForm(false)}
              className="text-sm text-on-surface-variant"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (needsAuth ? setShowAuthForm(true) : void addFree())}
          disabled={createServer.isPending}
          className="flex items-center justify-center gap-space-xs rounded-lg bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary-container disabled:opacity-50"
        >
          <Icon name="add" className="text-[18px]" />
          {createServer.isPending ? 'Adding…' : 'Add'}
        </button>
      )}
    </Card>
  );
}

export function MarketplacePage() {
  const { data: serverList } = useServers();
  const [filter, setFilter] = useState<AuthFilter>('all');

  const connectedUrls = useMemo(
    () => new Set((serverList ?? []).map((s) => s.url)),
    [serverList],
  );

  const filtered = MCP_CATALOG.filter((entry) => {
    if (filter === 'free') return entry.auth.type === 'none';
    if (filter === 'auth') return entry.auth.type === 'bearer';
    return true;
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-xl px-gutter-md py-space-lg">
      <div className="flex flex-col gap-space-base sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-space-xxs flex items-center gap-space-xs text-[11px] uppercase tracking-wider text-on-surface-variant">
            <span>Gateway Configuration</span>
            <span>/</span>
            <span className="font-semibold text-primary">Marketplace</span>
          </div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
            MCP Server Marketplace
          </h1>
          <p className="mt-space-xxs text-sm text-on-surface-variant">
            Known-working MCP servers you can connect with one click. Free servers need nothing
            further; auth-required ones need a credential you provide and set on the gateway.
          </p>
        </div>
        <div className="flex items-center gap-space-xs rounded-xl bg-surface-container-low p-space-xxs shadow-sm">
          {(['all', 'free', 'auth'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-space-md py-space-xs text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {value === 'all' ? 'All' : value === 'free' ? 'Free' : 'Auth required'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry) => (
          <MarketplaceCard key={entry.name} entry={entry} connected={connectedUrls.has(entry.url)} />
        ))}
      </div>
    </div>
  );
}
