import { useState } from 'react';
import type { IdentityWithUsage } from '../hooks/useIdentities';
import { Icon } from './Icon';
import { Modal } from './Modal';

const NO_PIN = '__no_pin__';

// Deleting a policy that one or more identities have pinned needs a
// decision about what happens to them — PATCH /api/identities/:id already
// supports pinning any policy or none (policyId: string | null), and
// DELETE /api/policies/:id (apps/server/src/api/policies.ts) accepts an
// optional reassignPolicyId that does exactly this in the same request,
// rather than the dashboard doing N follow-up PATCHes after the delete.
export function DeletePolicyModal({
  policy,
  affectedIdentities,
  otherPolicies,
  onClose,
  onConfirm,
  isDeleting,
}: {
  policy: { id: string; name: string };
  affectedIdentities: IdentityWithUsage[];
  otherPolicies: Array<{ id: string; name: string }>;
  onClose: () => void;
  onConfirm: (reassignPolicyId: string | null) => void;
  isDeleting: boolean;
}) {
  const [reassignTo, setReassignTo] = useState(NO_PIN);

  return (
    <Modal title={`Delete ${policy.name}?`} onClose={onClose}>
      <div className="flex flex-col gap-space-base">
        <p className="text-sm text-on-surface-variant">This can't be undone.</p>

        {affectedIdentities.length > 0 && (
          <>
            <div className="flex items-start gap-space-xs rounded-lg bg-secondary-container/30 p-space-sm text-sm">
              <Icon name="warning" className="mt-0.5 shrink-0 text-[18px] text-secondary" />
              <p>
                Pinned by {affectedIdentities.length}{' '}
                {affectedIdentities.length === 1 ? 'identity' : 'identities'}:{' '}
                <span className="font-mono text-xs">
                  {affectedIdentities.map((i) => i.name).join(', ')}
                </span>
                . Choose what happens to them below.
              </p>
            </div>

            <label className="flex flex-col gap-space-xs text-sm font-medium text-on-surface">
              Reassign those identities to
              <select
                value={reassignTo}
                onChange={(event) => setReassignTo(event.target.value)}
                className="rounded border border-outline-variant px-space-sm py-space-xs text-sm font-normal"
              >
                <option value={NO_PIN}>No pin (use account default)</option>
                {otherPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="flex items-center justify-end gap-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-space-base py-space-sm text-sm font-medium text-on-surface-variant hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reassignTo === NO_PIN ? null : reassignTo)}
            disabled={isDeleting}
            className="flex items-center gap-space-xs rounded-lg bg-error px-space-base py-space-sm text-sm font-medium text-on-error shadow-sm disabled:opacity-50"
          >
            <Icon name="delete_forever" className="text-[16px]" />
            {isDeleting ? 'Deleting…' : 'Delete Policy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
