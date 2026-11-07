import { useState, type FormEvent } from 'react';
import type { Policy, ServerConfig, UpdateIdentityInput } from '@adaptivegate/shared';
import type { IdentityWithUsage } from '../hooks/useIdentities';
import { Modal } from './Modal';

// Replaces the old window.prompt-based "Edit budget" — a real form over the
// same PATCH /api/identities/:id endpoint (updateIdentityInputSchema,
// packages/shared/src/schemas/identity.ts already accepts all three fields
// in one call), covering every real limit an identity has: daily call
// budget, pinned policy, and server scope. None of this is a new API call,
// just a better way to produce the one it already makes.
export function EditLimitsModal({
  identity,
  policies,
  servers,
  onClose,
  onSave,
  isSaving,
}: {
  identity: IdentityWithUsage;
  policies: Policy[];
  servers: ServerConfig[];
  onClose: () => void;
  onSave: (input: UpdateIdentityInput) => void;
  isSaving: boolean;
}) {
  const [unlimited, setUnlimited] = useState(identity.budgetLimit === null);
  const [budgetLimit, setBudgetLimit] = useState(String(identity.budgetLimit ?? ''));
  const [policyId, setPolicyId] = useState(identity.policyId ?? '');
  const [allServers, setAllServers] = useState(identity.serverScope === null);
  const [scopedServerIds, setScopedServerIds] = useState<Set<string>>(
    new Set(identity.serverScope ?? []),
  );

  function toggleServer(id: string) {
    setScopedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedBudget = Number(budgetLimit);
    onSave({
      budgetLimit: unlimited ? null : Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null,
      policyId: policyId || null,
      serverScope: allServers ? null : [...scopedServerIds],
    });
  }

  return (
    <Modal title={`Edit limits — ${identity.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-base">
        <fieldset className="flex flex-col gap-space-xs">
          <legend className="text-sm font-medium text-on-surface">Daily call budget</legend>
          <label className="flex items-center gap-space-xs text-sm text-on-surface-variant">
            <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
            Unlimited
          </label>
          {!unlimited && (
            <input
              type="number"
              min="1"
              value={budgetLimit}
              onChange={(event) => setBudgetLimit(event.target.value)}
              placeholder="e.g. 200"
              className="rounded border border-outline-variant px-space-sm py-space-xs text-sm"
            />
          )}
        </fieldset>

        <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
          Pinned policy
          <select
            value={policyId}
            onChange={(event) => setPolicyId(event.target.value)}
            className="rounded border border-outline-variant px-space-sm py-space-xs text-sm font-normal"
          >
            <option value="">No pin (use account default)</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-space-xs">
          <legend className="text-sm font-medium text-on-surface">Permitted MCP servers</legend>
          <label className="flex items-center gap-space-xs text-sm text-on-surface-variant">
            <input type="checkbox" checked={allServers} onChange={(e) => setAllServers(e.target.checked)} />
            All connected servers
          </label>
          {!allServers && (
            <div className="flex flex-col gap-space-xxs rounded-lg border border-outline-variant/40 p-space-sm">
              {servers.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No servers connected yet.</p>
              ) : (
                servers.map((server) => (
                  <label key={server.id} className="flex items-center gap-space-xs text-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={scopedServerIds.has(server.id)}
                      onChange={() => toggleServer(server.id)}
                    />
                    <span className="font-mono text-xs">{server.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </fieldset>

        <div className="flex items-center justify-end gap-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-space-base py-space-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-primary px-space-base py-space-sm text-sm font-medium text-on-primary shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save limits'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
