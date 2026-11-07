import { useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { PolicyRuleBuilder } from '../components/PolicyRuleBuilder';
import { StatTile } from '../components/StatTile';
import { StatusPill } from '../components/StatusPill';
import { POLICY_PACKS } from '../data/policyPacks';
import { useApprovals } from '../hooks/useApprovals';
import { useEventStats } from '../hooks/useEvents';
import { useIdentities } from '../hooks/useIdentities';
import { rulesToYaml, yamlToRules, type PolicyRuleDraft } from '../lib/policyRules';
import { useCreatePolicy, usePolicies } from '../hooks/usePolicies';

const DEFAULT_YAML = `version: 1
rules:
  - name: allow-everything
    match:
      tool: "*"
    action: allow
`;

interface PolicyRow {
  id: string;
  name: string;
  version: number;
  yaml: string;
  createdAt: Date;
}

function lineNumbers(text: string): string[] {
  return text.split('\n').map((_, i) => String(i + 1).padStart(2, '0'));
}

function PolicyPackCard({
  policy,
  isDefault,
  enforcedCount,
}: {
  policy: PolicyRow;
  isDefault: boolean;
  enforcedCount: number | null;
}) {
  const [expanded, setExpanded] = useState(isDefault);
  const [copied, setCopied] = useState(false);

  function copyManifest() {
    void navigator.clipboard?.writeText(policy.yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportYaml() {
    const blob = new Blob([policy.yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${policy.name}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex flex-col gap-space-sm p-space-base md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-space-md md:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
            <Icon name="security" className="text-[22px]" />
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="font-mono text-base font-semibold tracking-tight text-on-surface">
                {policy.name}
              </span>
              {isDefault ? (
                <StatusPill variant="allowed">Default policy</StatusPill>
              ) : (
                <StatusPill variant="neutral">Superseded</StatusPill>
              )}
              {enforcedCount !== null && (
                <span className="rounded-lg bg-surface-container px-space-xs py-0.5 text-[11px] text-on-surface-variant">
                  Pinned by {enforcedCount} {enforcedCount === 1 ? 'identity' : 'identities'}
                </span>
              )}
              <span className="rounded-lg bg-primary-fixed px-space-xs py-0.5 font-mono text-xs text-on-primary-fixed-variant">
                v{policy.version}
              </span>
            </div>
            <p className="font-mono text-xs text-on-surface-variant">
              {new Date(policy.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1 self-end rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface md:self-auto"
        >
          <span className="text-sm">{expanded ? 'Collapse' : 'Expand'}</span>
          <Icon name={expanded ? 'expand_less' : 'expand_more'} className="text-[20px]" />
        </button>
      </div>

      {expanded && (
        <div className="relative m-space-base mt-0 rounded-xl bg-inverse-surface p-space-base shadow-inner">
          <div className="mb-space-sm flex items-center justify-between pb-space-sm text-[11px] text-on-surface-variant">
            <span className="font-mono text-outline-variant">{policy.name}</span>
            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                onClick={exportYaml}
                className="flex items-center gap-1 rounded bg-surface-container-highest/20 px-space-sm py-1 font-mono text-xs text-surface-bright transition-all hover:bg-surface-container-highest/30"
              >
                <Icon name="download" className="text-[14px]" />
                Export YAML
              </button>
              <button
                type="button"
                onClick={copyManifest}
                className="flex items-center gap-1 rounded bg-surface-container-highest/20 px-space-sm py-1 font-mono text-xs text-surface-bright transition-all hover:bg-surface-container-highest/30"
              >
                <Icon name="content_copy" className="text-[14px]" />
                {copied ? 'Copied!' : 'Copy Manifest'}
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto font-mono text-xs leading-relaxed">
            <div className="select-none space-y-0.5 pr-space-base text-right text-outline-variant opacity-60">
              {lineNumbers(policy.yaml).map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
            <pre className="flex-1 space-y-0.5 text-surface-bright">{policy.yaml}</pre>
          </div>
        </div>
      )}
    </Card>
  );
}

export function PoliciesPage() {
  const { data: policyList, isLoading } = usePolicies();
  const { data: identities } = useIdentities();
  const { data: stats } = useEventStats();
  const { data: approvals } = useApprovals();
  const createPolicy = useCreatePolicy();

  const [name, setName] = useState('');
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [rules, setRules] = useState<PolicyRuleDraft[]>(() => yamlToRules(DEFAULT_YAML) ?? []);
  // 'rules' is the default — most users should never have to hand-write
  // YAML. 'yaml' stays available for power users and for pasting an
  // exported pack back in; it's disabled (not hidden) when the current
  // yaml doesn't round-trip through yamlToRules, so a hand-edit is never
  // silently discarded by switching tabs.
  const [mode, setMode] = useState<'rules' | 'yaml'>('rules');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const sortedPolicies = policyList
    ? [...policyList].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];
  const defaultPolicyId = sortedPolicies[0]?.id;
  const pendingApprovals = approvals?.filter((a) => a.status === 'pending' && !a.isExpired).length;

  const effectiveYaml = mode === 'rules' ? rulesToYaml(rules) : yaml;
  const yamlParsesToRules = yamlToRules(yaml) !== null;

  function applyPack(packYaml: string, packName: string) {
    setYaml(packYaml);
    setRules(yamlToRules(packYaml) ?? []);
    setMode('rules');
    if (!name) setName(packName);
  }

  function switchToRulesMode() {
    const parsed = yamlToRules(yaml);
    if (parsed) setRules(parsed);
    setMode('rules');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createPolicy.mutateAsync({ name, yaml: effectiveYaml });
      setName('');
      setYaml(DEFAULT_YAML);
      setRules(yamlToRules(DEFAULT_YAML) ?? []);
      setMode('rules');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-xl px-gutter-md py-space-lg">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-space-xxs">
          <div className="flex items-center gap-space-xs text-[11px] uppercase tracking-widest text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span>Security Engine • Rule Matrix</span>
          </div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
            Governance &amp; Security Policies
          </h1>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Deterministic guardrails compiled to gateway rules — the most recently created policy
            is the default for every identity without one pinned.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-1 self-start rounded-lg bg-primary px-space-base py-space-sm text-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary-container md:self-auto"
        >
          <Icon name="add" className="text-[18px]" />
          {showForm ? 'Cancel' : 'Add Policy Pack'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Policy packs" value={policyList?.length ?? 0} icon="verified_user" iconColorClass="text-tertiary" />
        <StatTile label="Blocked calls" value={stats?.blocked ?? 0} icon="gpp_bad" iconColorClass="text-error" />
        <StatTile
          label="Pending approvals"
          value={pendingApprovals ?? 0}
          icon="pending_actions"
          iconColorClass="text-secondary"
        />
        <StatTile label="Tool calls governed" value={stats?.total ?? 0} icon="bolt" iconColorClass="text-primary" />
      </div>

      {showForm && (
        <Card className="flex flex-col gap-space-lg !p-space-lg">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary">
              <Icon name="add_moderator" className="text-[18px]" />
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold text-on-surface">Create New Policy Pack</h2>
              <p className="text-sm text-on-surface-variant">
                Pushed as a new version — it becomes the default the moment it saves.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-space-base">
            <div className="flex flex-col gap-space-sm">
              <span className="text-sm font-medium text-on-surface">Start from a pack (optional)</span>
              <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
                {POLICY_PACKS.map((pack) => (
                  <button
                    key={pack.name}
                    type="button"
                    onClick={() => applyPack(pack.yaml, pack.name)}
                    className="flex flex-col gap-space-xxs rounded-lg border border-outline-variant/40 bg-surface-container-low p-space-sm text-left transition-colors hover:border-primary hover:bg-surface-container"
                  >
                    <span className="font-mono text-sm font-semibold text-on-surface">{pack.name}</span>
                    <span className="text-xs text-on-surface-variant">{pack.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
              Policy Pack Name
              <div className="relative flex items-center">
                <Icon name="description" className="absolute left-3 text-[18px] text-on-surface-variant" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="prod-safety-core"
                  className="w-full rounded-lg bg-surface-container-low py-space-sm pl-10 pr-space-base font-mono text-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none"
                  required
                />
              </div>
            </label>

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface">Policy Specification</span>
                <div className="flex rounded-lg bg-surface-container-low p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={switchToRulesMode}
                    disabled={mode === 'yaml' && !yamlParsesToRules}
                    className={`rounded px-space-sm py-1 transition-colors disabled:opacity-40 ${mode === 'rules' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('yaml')}
                    className={`rounded px-space-sm py-1 transition-colors ${mode === 'yaml' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Raw YAML
                  </button>
                </div>
              </div>

              {mode === 'rules' ? (
                <>
                  <PolicyRuleBuilder rules={rules} onChange={setRules} />
                  <details className="rounded-lg bg-surface-container-low px-space-sm py-space-xs text-xs text-on-surface-variant">
                    <summary className="cursor-pointer font-medium text-on-surface">Preview compiled YAML</summary>
                    <pre className="mt-space-xs overflow-x-auto font-mono text-[11px] leading-relaxed">{effectiveYaml}</pre>
                  </details>
                </>
              ) : (
                <>
                  {!yamlParsesToRules && (
                    <p className="flex items-center gap-1 text-xs text-secondary">
                      <Icon name="info" className="text-[14px]" />
                      This YAML doesn't match the Rules tab's simple shape (comments, extra fields,
                      or different formatting) — that's fine, it'll still save and run exactly as
                      written, but the Rules tab can't edit it until it round-trips cleanly.
                    </p>
                  )}
                  <div className="flex rounded-xl bg-inverse-surface p-space-base font-mono text-xs leading-relaxed shadow-inner">
                    <div className="select-none space-y-0.5 pr-space-base text-right text-outline-variant opacity-60">
                      {lineNumbers(yaml).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                    <textarea
                      value={yaml}
                      onChange={(event) => setYaml(event.target.value)}
                      rows={lineNumbers(yaml).length}
                      spellCheck={false}
                      className="w-full flex-1 resize-none bg-transparent font-mono text-xs leading-relaxed text-inverse-on-surface focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-space-xs rounded-lg bg-error-container px-space-md py-space-sm">
                <Icon name="error" className="text-[18px] text-on-error-container" />
                <span className="text-sm font-medium text-on-error-container">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-space-sm">
              <button
                type="submit"
                disabled={createPolicy.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-space-lg py-space-sm text-sm font-medium text-on-primary shadow-sm transition-all disabled:opacity-50"
              >
                <Icon name="rocket_launch" className="text-[18px]" />
                {createPolicy.isPending ? 'Deploying…' : 'Deploy Policy'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-space-base">
        <div className="flex items-center gap-space-sm px-space-xs">
          <span className="font-sans text-base font-semibold text-on-surface">Policy history</span>
          <span className="rounded-lg bg-surface-container-high px-space-xs py-0.5 font-mono text-xs text-on-surface-variant">
            {sortedPolicies.length} {sortedPolicies.length === 1 ? 'pack' : 'packs'}
          </span>
        </div>

        {isLoading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : sortedPolicies.length > 0 ? (
          sortedPolicies.map((policy) => (
            <PolicyPackCard
              key={policy.id}
              policy={policy}
              isDefault={policy.id === defaultPolicyId}
              enforcedCount={identities ? identities.filter((i) => i.policyId === policy.id).length : null}
            />
          ))
        ) : (
          <p className="text-on-surface-variant">
            No policies yet — every call_tool request is denied by default until one exists.
          </p>
        )}
      </div>
    </div>
  );
}
