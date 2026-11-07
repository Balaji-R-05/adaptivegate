import { useMemo, useState, type FormEvent } from 'react';
import type { UpdateIdentityInput } from '@adaptivegate/shared';
import { Card } from '../components/Card';
import { EditLimitsModal } from '../components/EditLimitsModal';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/StatTile';
import {
  useCreateIdentity,
  useDeleteIdentity,
  useIdentities,
  useUpdateIdentity,
  type CreatedIdentity,
  type IdentityWithUsage,
} from '../hooks/useIdentities';
import { usePolicies } from '../hooks/usePolicies';
import { useServers } from '../hooks/useServers';
import { connectSnippet, copyText, type SnippetTab } from '../lib/connectSnippet';

// Mirrors the severity bands used throughout the mockups (nominal /
// near-limit / disabled) — computed from real usedToday/budgetLimit, never
// fabricated.
function severity(identity: IdentityWithUsage): 'disabled' | 'warning' | 'nominal' {
  if (!identity.enabled) return 'disabled';
  if (identity.budgetLimit && identity.usedToday / identity.budgetLimit >= 0.85) return 'warning';
  return 'nominal';
}

const STRIPE_CLASS: Record<ReturnType<typeof severity>, string> = {
  disabled: 'bg-error',
  warning: 'bg-secondary-container',
  nominal: 'bg-tertiary-container',
};

function IdentityCard({
  identity,
  policyName,
  serverNames,
  onToggle,
  onEditLimits,
  onDelete,
}: {
  identity: IdentityWithUsage;
  policyName: string | undefined;
  serverNames: string[] | null;
  onToggle: (identity: IdentityWithUsage) => void;
  onEditLimits: (identity: IdentityWithUsage) => void;
  onDelete: (id: string) => void;
}) {
  const hasLimit = identity.budgetLimit !== null;
  const pct = hasLimit ? Math.min(100, Math.round((identity.usedToday / identity.budgetLimit!) * 100)) : 0;
  const state = severity(identity);

  return (
    <Card className="relative overflow-hidden !p-space-lg">
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${STRIPE_CLASS[state]}`} />
      <div className="flex flex-col gap-space-md pl-space-xs">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-center">
          <div className="flex items-center gap-space-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-low text-primary-container">
              <Icon name="smart_toy" className="text-[24px]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="font-sans text-base font-semibold text-on-surface">{identity.name}</span>
                <span
                  className={`flex items-center gap-1 rounded-full px-space-xs py-0.5 text-[11px] font-medium ${
                    identity.enabled
                      ? 'bg-surface-container-high text-tertiary-container'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${identity.enabled ? 'bg-tertiary-container' : 'bg-error'}`} />
                  {identity.enabled ? 'Active' : 'Disabled'}
                </span>
                {state === 'warning' && (
                  <span className="flex items-center gap-1 rounded-full bg-secondary-container px-space-xs py-0.5 text-[11px] font-semibold text-on-secondary-container">
                    <Icon name="warning" className="text-[12px]" />
                    Near Quota
                  </span>
                )}
              </div>
              <div className="mt-space-xxs flex flex-wrap items-center gap-space-md text-on-surface-variant">
                <span className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-xs py-0.5 font-mono text-xs">
                  <span className="text-on-surface-variant/70">ID</span>
                  <span className="font-medium text-on-surface">{identity.id.slice(0, 8)}</span>
                </span>
                {policyName && (
                  <span className="flex items-center gap-1 text-sm">
                    <Icon name="description" className="text-[15px]" />
                    Policy: <code className="font-mono text-xs font-semibold text-primary">{policyName}</code>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-space-xs self-start md:self-auto">
            <button
              type="button"
              onClick={() => onEditLimits(identity)}
              className="flex h-8 items-center gap-1 rounded-lg bg-surface-container-low px-space-sm text-xs font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="tune" className="text-[15px]" />
              Edit limits
            </button>
            <button
              type="button"
              onClick={() => onToggle(identity)}
              className="flex h-8 items-center gap-1 rounded-lg bg-surface-container-low px-space-sm text-xs font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name={identity.enabled ? 'toggle_on' : 'toggle_off'} className="text-[15px]" />
              {identity.enabled ? 'Disable (kill switch)' : 'Enable'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(identity.id)}
              className="flex h-8 items-center gap-1 rounded-lg bg-surface-container-low px-space-sm text-xs font-medium text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
            >
              <Icon name="delete_forever" className="text-[15px]" />
              Remove
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low/60 p-space-base">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-on-surface-variant">
              <Icon name="pie_chart" className="text-[15px]" />
              Daily Call Budget
            </span>
            <span className="font-mono font-medium text-on-surface">
              {hasLimit ? `${identity.usedToday} / ${identity.budgetLimit}` : `${identity.usedToday} calls`}
            </span>
          </div>
          {hasLimit && (
            <>
              <div className="mt-space-xs h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${state === 'warning' ? 'bg-secondary-container' : 'bg-primary-container'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-space-xs flex items-center justify-between text-[11px]">
                <span className={state === 'warning' ? 'font-semibold text-secondary' : 'text-on-surface-variant'}>
                  {pct}% used
                </span>
                <span className="font-mono text-on-surface-variant">
                  {identity.budgetLimit! - identity.usedToday} calls remaining today
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-space-sm pt-space-xs">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <Icon name="dns" className="text-[14px]" />
            Permitted MCP servers:
          </span>
          {serverNames === null ? (
            <span className="font-mono text-xs text-on-surface-variant">all connected servers</span>
          ) : serverNames.length === 0 ? (
            <span className="font-mono text-xs text-on-surface-variant">none</span>
          ) : (
            serverNames.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 rounded-lg bg-surface-container px-space-sm py-1 font-mono text-xs text-on-surface"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
                {name}
              </span>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

export function IdentitiesPage() {
  const { data: identityList, isLoading } = useIdentities();
  const { data: policies } = usePolicies();
  const { data: servers } = useServers();
  const createIdentity = useCreateIdentity();
  const updateIdentity = useUpdateIdentity();
  const deleteIdentity = useDeleteIdentity();

  const [name, setName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedIdentity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState<IdentityWithUsage | null>(null);
  const [snippetTab, setSnippetTab] = useState<SnippetTab>('claude');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

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

  function handleSaveLimits(input: UpdateIdentityInput) {
    if (!editingIdentity) return;
    updateIdentity.mutate(
      { id: editingIdentity.id, input },
      { onSuccess: () => setEditingIdentity(null) },
    );
  }

  const policyNameById = useMemo(
    () => new Map((policies ?? []).map((policy) => [policy.id, policy.name])),
    [policies],
  );
  const serverNameById = useMemo(
    () => new Map((servers ?? []).map((server) => [server.id, server.name])),
    [servers],
  );

  const filtered = useMemo(
    () => (identityList ?? []).filter((identity) => identity.name.toLowerCase().includes(search.toLowerCase())),
    [identityList, search],
  );

  const totalCallsToday = (identityList ?? []).reduce((sum, i) => sum + i.usedToday, 0);
  const activeCount = (identityList ?? []).filter((i) => i.enabled).length;
  const nearLimitCount = (identityList ?? []).filter((i) => severity(i) === 'warning').length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex flex-col gap-space-xxs">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
              Agent Identities &amp; Quotas
            </h1>
            <span className="rounded-lg bg-surface-container px-space-xs py-0.5 font-mono text-xs text-on-surface-variant">
              {identityList?.length ?? 0} identities
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            Manage individual agent credentials, daily call budgets, and assigned policy packs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="relative flex items-center">
            <Icon name="search" className="pointer-events-none absolute left-3 text-[18px] text-on-surface-variant" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter identities…"
              className="h-9 w-60 rounded-lg bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface shadow-sm transition-colors focus:bg-surface-container-low focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="flex h-9 items-center gap-space-xs rounded-lg bg-primary-container px-space-md text-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-primary"
          >
            <Icon name="add" className="text-[18px]" />
            {showForm ? 'Cancel' : 'Create Agent Identity'}
          </button>
        </div>
      </div>

      {identityList && identityList.length > 0 && (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Identities" value={identityList.length} icon="group" iconColorClass="text-primary" />
          <StatTile label="Active" value={activeCount} icon="toggle_on" iconColorClass="text-tertiary" />
          <StatTile label="Calls today" value={totalCallsToday} icon="build" iconColorClass="text-secondary" />
          <StatTile
            label="Near quota"
            value={nearLimitCount}
            icon="warning"
            iconColorClass={nearLimitCount > 0 ? 'text-secondary' : 'text-on-surface-variant'}
          />
        </div>
      )}

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
        <Card className="relative overflow-hidden !p-space-base">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-tertiary-container" />
          <div className="flex flex-col justify-between gap-space-md pl-space-xs lg:flex-row lg:items-center">
            <div className="flex items-start gap-space-md">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-tertiary-container">
                <Icon name="key" className="text-[20px]" />
              </div>
              <div className="flex flex-col gap-space-xxs">
                <div className="flex flex-wrap items-center gap-space-sm">
                  <h2 className="font-sans text-base font-semibold text-on-surface">
                    Identity created: {justCreated.name}
                  </h2>
                  <span className="rounded-full bg-tertiary-container/15 px-space-xs py-0.5 text-[11px] font-semibold text-on-tertiary-container">
                    Active once-only token
                  </span>
                </div>
                <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                  <Icon name="lock" className="text-[15px] text-error" />
                  Copy this key now — it can&apos;t be retrieved again.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJustCreated(null)}
              className="flex h-8 items-center gap-1 self-end rounded-lg px-space-sm text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface lg:self-center"
            >
              <Icon name="close" className="text-[16px]" />
              Dismiss
            </button>
          </div>
          <div className="mt-space-md flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm pl-space-md">
            <code className="select-all truncate font-mono text-sm text-on-surface">{justCreated.key}</code>
            <button
              type="button"
              onClick={() => {
                void copyText(justCreated.key);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex shrink-0 items-center gap-space-xxs rounded-lg bg-primary-container px-space-sm py-1 text-xs font-medium text-on-primary shadow-sm transition-colors hover:bg-primary"
            >
              <Icon name={copied ? 'check' : 'content_copy'} className="text-[15px]" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="mt-space-md flex flex-col gap-space-xs pl-space-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">
                Connect this identity directly
              </span>
              <div className="flex items-center gap-space-xs">
                <div className="flex items-center gap-space-xxs">
                  {(['claude', 'curl'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSnippetTab(tab)}
                      className={`rounded px-space-sm py-0.5 text-[11px] transition-colors ${
                        snippetTab === tab
                          ? 'bg-inverse-surface text-inverse-on-surface'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {tab === 'claude' ? 'Claude Code' : 'curl'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void copyText(connectSnippet(snippetTab, justCreated.key));
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="flex items-center gap-space-xxs rounded-lg bg-surface-container-low px-space-sm py-0.5 text-[11px] font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  <Icon name={copiedSnippet ? 'check' : 'content_copy'} className="text-[13px]" />
                  {copiedSnippet ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg bg-inverse-surface p-space-sm shadow-inner">
              <pre className="font-mono text-xs leading-relaxed text-inverse-on-surface">
                {connectSnippet(snippetTab, justCreated.key)}
              </pre>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-space-md">
          {filtered.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              policyName={identity.policyId ? policyNameById.get(identity.policyId) : undefined}
              serverNames={
                identity.serverScope
                  ? identity.serverScope.map((id) => serverNameById.get(id) ?? id)
                  : null
              }
              onToggle={(id) => updateIdentity.mutate({ id: id.id, input: { enabled: !id.enabled } })}
              onEditLimits={setEditingIdentity}
              onDelete={(id) => deleteIdentity.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">
          {identityList && identityList.length > 0
            ? 'No identities match that filter.'
            : 'No identities yet — API keys created on the Connect page are unrestricted until scoped to one.'}
        </p>
      )}

      {editingIdentity && (
        <EditLimitsModal
          identity={editingIdentity}
          policies={policies ?? []}
          servers={servers ?? []}
          onClose={() => setEditingIdentity(null)}
          onSave={handleSaveLimits}
          isSaving={updateIdentity.isPending}
        />
      )}
    </div>
  );
}
