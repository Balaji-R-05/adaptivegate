import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
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
    <div className="mx-auto flex max-w-3xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Connect</h1>

      <Card>
        <form onSubmit={handleCreate} className="flex items-end gap-space-sm">
          <label className="flex flex-1 flex-col gap-1 text-sm text-on-surface-variant">
            Key label
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
            Create key
          </button>
        </form>
      </Card>

      {justCreatedKey && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="mb-space-sm flex items-center gap-1 text-sm font-medium text-amber-900">
            <Icon name="visibility" className="text-[16px]" />
            This key is shown once — copy it now, it can&apos;t be retrieved again.
          </p>
          <code className="block break-all rounded bg-white px-space-sm py-space-xs font-mono text-sm">
            {justCreatedKey}
          </code>
          <pre className="mt-space-sm overflow-x-auto rounded-xl bg-inverse-surface p-space-sm font-mono text-xs text-inverse-on-surface shadow-inner">
            {`claude mcp add --transport http adaptivegate ${GATEWAY_URL}/mcp \\\n  --header "Authorization: Bearer ${justCreatedKey}"`}
          </pre>
        </Card>
      )}

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : keys && keys.length > 0 ? (
        <div className="flex flex-col gap-space-sm">
          {keys.map((key) => (
            <Card key={key.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-on-surface">{key.label}</p>
                <p className="text-sm text-on-surface-variant">{key.revokedAt ? 'Revoked' : 'Active'}</p>
              </div>
              {!key.revokedAt && (
                <button
                  type="button"
                  onClick={() => revokeKey.mutate(key.id)}
                  className="text-sm text-error"
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
  );
}
