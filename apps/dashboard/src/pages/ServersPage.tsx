import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { useCreateServer, useDeleteServer, useResyncServer, useServers } from '../hooks/useServers';

export function ServersPage() {
  const { data: serverList, isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const resyncServer = useResyncServer();
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleResync(id: string) {
    setResyncMessage(null);
    try {
      const result = await resyncServer.mutateAsync(id);
      setResyncMessage(`Indexed ${result.toolCount} tool(s).`);
    } catch (err) {
      setResyncMessage(err instanceof Error ? err.message : 'Resync failed');
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Servers</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary hover:bg-primary-container"
        >
          {showForm ? 'Cancel' : 'Add server'}
        </button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded border border-outline-variant px-space-sm py-space-xs"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              URL
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                type="url"
                placeholder="https://example.com/mcp"
                className="rounded border border-outline-variant px-space-sm py-space-xs"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Auth
              <select
                value={authType}
                onChange={(event) => setAuthType(event.target.value as 'none' | 'bearer')}
                className="rounded border border-outline-variant px-space-sm py-space-xs"
              >
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
              </select>
            </label>
            {authType === 'bearer' && (
              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                Token env var name
                <input
                  value={tokenEnv}
                  onChange={(event) => setTokenEnv(event.target.value)}
                  placeholder="GITHUB_MCP_TOKEN"
                  className="rounded border border-outline-variant px-space-sm py-space-xs"
                  required
                />
                <span className="text-xs text-on-surface-variant">
                  The actual token must already be set as this env var on the gateway server —
                  it&apos;s never sent to or stored by the dashboard.
                </span>
              </label>
            )}
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={createServer.isPending}
              className="mt-space-xs self-start rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
            >
              {createServer.isPending ? 'Adding…' : 'Add server'}
            </button>
          </form>
        </Card>
      )}

      {resyncMessage && <p className="text-sm text-on-surface-variant">{resyncMessage}</p>}

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : serverList && serverList.length > 0 ? (
        <div className="flex flex-col gap-space-sm">
          {serverList.map((server) => (
            <Card key={server.id} className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <Icon name="dns" className="text-[20px] text-primary" />
                <div>
                  <p className="font-medium text-on-surface">{server.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">{server.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <button
                  type="button"
                  onClick={() => handleResync(server.id)}
                  disabled={resyncServer.isPending}
                  className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface disabled:opacity-50"
                >
                  <Icon name="autorenew" className="text-[16px]" />
                  Resync
                </button>
                <button
                  type="button"
                  onClick={() => deleteServer.mutate(server.id)}
                  className="text-sm text-error"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">No servers yet.</p>
      )}
    </div>
  );
}
