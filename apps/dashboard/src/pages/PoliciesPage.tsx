import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { useCreatePolicy, usePolicies } from '../hooks/usePolicies';

const DEFAULT_YAML = `version: 1
rules:
  - name: allow-everything
    match:
      tool: "*"
    action: allow
`;

function PolicyRow({ policy }: { policy: { id: string; name: string; version: number; yaml: string } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden !p-0">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-space-sm p-space-base text-left"
      >
        <div className="flex items-center gap-space-sm">
          <Icon name="policy" className="text-[18px] text-primary" />
          <span className="font-medium text-on-surface">{policy.name}</span>
          <span className="rounded-lg bg-surface-container-low px-space-xs py-0.5 font-mono text-xs text-on-surface-variant">
            v{policy.version}
          </span>
        </div>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} className="text-[18px] text-on-surface-variant" />
      </button>
      {expanded && (
        <div className="m-space-base mt-0 rounded-xl bg-inverse-surface p-space-base shadow-inner">
          <pre className="overflow-x-auto font-mono text-xs text-inverse-on-surface">{policy.yaml}</pre>
        </div>
      )}
    </Card>
  );
}

export function PoliciesPage() {
  const { data: policyList, isLoading } = usePolicies();
  const createPolicy = useCreatePolicy();

  const [name, setName] = useState('');
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createPolicy.mutateAsync({ name, yaml });
      setName('');
      setYaml(DEFAULT_YAML);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Policies</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary hover:bg-primary-container"
        >
          {showForm ? 'Cancel' : 'Add policy'}
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
              YAML
              <textarea
                value={yaml}
                onChange={(event) => setYaml(event.target.value)}
                rows={8}
                className="rounded border border-outline-variant px-space-sm py-space-xs font-mono text-xs"
              />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={createPolicy.isPending}
              className="self-start rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
            >
              {createPolicy.isPending ? 'Saving…' : 'Save policy'}
            </button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : policyList && policyList.length > 0 ? (
        <div className="flex flex-col gap-space-sm">
          {policyList.map((policy) => (
            <PolicyRow key={policy.id} policy={policy} />
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant">
          No policies yet — every call_tool request is denied by default until one exists.
        </p>
      )}
    </div>
  );
}
