import { useState, type FormEvent } from 'react';
import { useCreateServer, useDeleteServer, useServers } from '../hooks/useServers';

export function ServersPage() {
  const { data: serverList, isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createServer.mutateAsync({ name, url, auth: { type: 'none' }, enabledTools: [] });
      setName('');
      setUrl('');
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={createServer.isPending}
          className="mt-2 self-start rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {createServer.isPending ? 'Adding…' : 'Add server'}
        </button>
      </form>

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
              <button
                type="button"
                onClick={() => deleteServer.mutate(server.id)}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">No servers yet.</p>
      )}
    </section>
  );
}
