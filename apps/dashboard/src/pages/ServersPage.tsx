import { useState, type FormEvent } from 'react';
import { useCreateServer, useDeleteServer, useResyncServer, useServers } from '../hooks/useServers';

export function ServersPage() {
  const { data: serverList, isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const resyncServer = useResyncServer();
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    }
  }

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Servers</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-2 rounded border border-slate-200 p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            placeholder="https://example.com/mcp"
            className="rounded border border-slate-300 px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Auth
          <select
            value={authType}
            onChange={(event) => setAuthType(event.target.value as 'none' | 'bearer')}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
          </select>
        </label>
        {authType === 'bearer' && (
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Token env var name
            <input
              value={tokenEnv}
              onChange={(event) => setTokenEnv(event.target.value)}
              placeholder="GITHUB_MCP_TOKEN"
              className="rounded border border-slate-300 px-2 py-1"
              required
            />
            <span className="text-xs text-slate-500">
              The actual token must already be set as this env var on the gateway server — it&apos;s
              never sent to or stored by the dashboard.
            </span>
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={createServer.isPending}
          className="mt-2 self-start rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {createServer.isPending ? 'Adding…' : 'Add server'}
        </button>
      </form>

      {resyncMessage && <p className="mb-2 text-sm text-slate-600">{resyncMessage}</p>}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : serverList && serverList.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {serverList.map((server) => (
            <li
              key={server.id}
              className="flex items-center justify-between rounded border border-slate-200 px-4 py-2"
            >
              <div>
                <p className="font-medium text-slate-900">{server.name}</p>
                <p className="text-sm text-slate-500">{server.url}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleResync(server.id)}
                  disabled={resyncServer.isPending}
                  className="text-sm text-slate-600 disabled:opacity-50"
                >
                  Resync
                </button>
                <button
                  type="button"
                  onClick={() => deleteServer.mutate(server.id)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">No servers yet.</p>
      )}
    </section>
  );
}
