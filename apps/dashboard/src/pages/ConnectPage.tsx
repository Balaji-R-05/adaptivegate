import { useState, type FormEvent } from 'react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApiKeys';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

export function ConnectPage() {
  const { data: keys, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [label, setLabel] = useState('');
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const result = await createKey.mutateAsync({ label });
    setJustCreatedKey(result.key);
    setLabel('');
  }

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Connect</h2>

      <form onSubmit={handleCreate} className="mb-4 flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Key label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="laptop"
            className="rounded border border-slate-300 px-2 py-1"
            required
          />
        </label>
        <button
          type="submit"
          disabled={createKey.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Create key
        </button>
      </form>

      {justCreatedKey && (
        <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm text-amber-900">
            This key is shown once — copy it now, it can&apos;t be retrieved again.
          </p>
          <code className="block break-all rounded bg-white px-2 py-1 text-sm">
            {justCreatedKey}
          </code>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {`claude mcp add --transport http adaptivegate ${GATEWAY_URL}/mcp \\\n  --header "Authorization: Bearer ${justCreatedKey}"`}
          </pre>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : keys && keys.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between rounded border border-slate-200 px-4 py-2"
            >
              <div>
                <p className="font-medium text-slate-900">{key.label}</p>
                <p className="text-sm text-slate-500">{key.revokedAt ? 'Revoked' : 'Active'}</p>
              </div>
              {!key.revokedAt && (
                <button
                  type="button"
                  onClick={() => revokeKey.mutate(key.id)}
                  className="text-sm text-red-600"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">No API keys yet.</p>
      )}
    </section>
  );
}
