import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import {
  useCreateIdentity,
  useDeleteIdentity,
  useIdentities,
  useUpdateIdentity,
  type CreatedIdentity,
  type IdentityWithUsage,
} from '../hooks/useIdentities';

function IdentityCard({
  identity,
  onToggle,
  onDelete,
}: {
  identity: IdentityWithUsage;
  onToggle: (identity: IdentityWithUsage) => void;
  onDelete: (id: string) => void;
}) {
  const hasLimit = identity.budgetLimit !== null;
  const pct = hasLimit ? Math.min(100, Math.round((identity.usedToday / identity.budgetLimit!) * 100)) : 0;
  const barColor = pct >= 85 ? 'bg-error' : 'bg-primary';

  return (
    <Card className="flex flex-col justify-between gap-space-md !p-0">
      <div className="flex flex-col gap-space-xs p-space-base pb-0">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-surface-container-high px-space-xs py-0.5 font-mono text-[11px] text-on-surface">
            {identity.serverScope ? `${identity.serverScope.length} server(s)` : 'all servers'}
          </span>
          <span className={`h-2 w-2 rounded-full ${identity.enabled ? 'bg-tertiary-container' : 'bg-error'}`} />
        </div>
        <span className="truncate pt-space-xs font-sans text-base font-semibold text-on-surface" title={identity.name}>
          {identity.name}
        </span>
      </div>

      <div className="flex flex-col gap-space-xs px-space-base">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Daily Call Budget</span>
          <span className="font-mono text-xs font-medium text-on-surface">
            {hasLimit ? (
              <>
                {identity.usedToday} / {identity.budgetLimit}{' '}
                <span className={`font-semibold ${pct >= 85 ? 'text-error' : 'text-primary'}`}>
                  ({pct}%)
                </span>
              </>
            ) : (
              `${identity.usedToday} calls (unlimited)`
            )}
          </span>
        </div>
        {hasLimit && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-b-xl bg-surface-container-low/50 px-space-base py-space-sm">
        <span className="text-[11px] text-on-surface-variant">Tool Invocations</span>
        <span className="font-mono text-xs font-semibold text-on-surface">{identity.usedToday}</span>
      </div>

      <div className="flex items-center gap-space-sm px-space-base pb-space-base pt-0">
        <button
          type="button"
          onClick={() => onToggle(identity)}
          className="flex items-center gap-1 rounded bg-surface-container-low px-space-sm py-1 text-xs font-medium text-on-surface hover:bg-surface-container"
        >
          <Icon name={identity.enabled ? 'toggle_on' : 'toggle_off'} className="text-[16px]" />
          {identity.enabled ? 'Disable (kill switch)' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(identity.id)}
          className="text-xs font-medium text-error"
        >
          Remove
        </button>
      </div>
    </Card>
  );
}

export function IdentitiesPage() {
  const { data: identityList, isLoading } = useIdentities();
  const createIdentity = useCreateIdentity();
  const updateIdentity = useUpdateIdentity();
  const deleteIdentity = useDeleteIdentity();

  const [name, setName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedIdentity | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await createIdentity.mutateAsync({
        name,
        serverScope: null,
        budgetLimit: budgetLimit ? Number(budgetLimit) : null,
        policyId: null,
      });
      setJustCreated(result);
      setName('');
      setBudgetLimit('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create identity');
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Identities</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary hover:bg-primary-container"
        >
          {showForm ? 'Cancel' : 'Create identity'}
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
                placeholder="coding-agent"
                className="rounded border border-outline-variant px-space-sm py-space-xs"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Daily call budget (optional)
              <input
                value={budgetLimit}
                onChange={(event) => setBudgetLimit(event.target.value)}
                type="number"
                min="1"
                placeholder="unlimited"
                className="rounded border border-outline-variant px-space-sm py-space-xs"
              />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={createIdentity.isPending}
              className="self-start rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
            >
              {createIdentity.isPending ? 'Creating…' : 'Create'}
            </button>
          </form>
        </Card>
      )}

      {justCreated && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="mb-2 text-sm text-amber-900">
            This identity's API key is shown once — copy it now, it can&apos;t be retrieved again.
          </p>
          <code className="block break-all rounded bg-white px-space-sm py-space-xs text-xs">
            {justCreated.key}
          </code>
        </Card>
      )}

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : identityList && identityList.length > 0 ? (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
          {identityList.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              onToggle={(id) => updateIdentity.mutate({ id: id.id, input: { enabled: !id.enabled } })}
              onDelete={(id) => deleteIdentity.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">
          No identities yet — API keys created on the Connect page are unrestricted until scoped to one.
        </p>
      )}
    </div>
  );
}
