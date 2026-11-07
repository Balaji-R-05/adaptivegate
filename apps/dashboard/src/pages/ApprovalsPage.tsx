import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { useApprovals, useResolveApproval, type ApprovalWithExpiry } from '../hooks/useApprovals';

function PendingCard({ approval }: { approval: ApprovalWithExpiry }) {
  const resolve = useResolveApproval();

  return (
    <Card className="flex flex-col gap-space-md border-l-4 border-l-secondary">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-on-surface">{approval.tool}</span>
        {approval.isExpired ? (
          <StatusPill variant="neutral">Expired</StatusPill>
        ) : (
          <StatusPill variant="pending">Pending approval</StatusPill>
        )}
      </div>
      <div className="grid grid-cols-2 gap-space-sm text-xs text-on-surface-variant sm:grid-cols-3">
        <span>
          Identity: <span className="font-mono text-on-surface">{approval.identityId ?? 'default'}</span>
        </span>
        <span>
          Server: <span className="font-mono text-on-surface">{approval.serverId}</span>
        </span>
        <span>
          Rule: <span className="font-mono text-on-surface">{approval.ruleName}</span>
        </span>
      </div>
      {approval.argumentsRedacted && (
        <div className="rounded-xl bg-inverse-surface p-space-sm shadow-inner">
          <pre className="overflow-x-auto font-mono text-xs text-inverse-on-surface">
            {JSON.stringify(approval.argumentsRedacted, null, 2)}
          </pre>
        </div>
      )}
      {!approval.isExpired && (
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={() => resolve.mutate({ id: approval.id, decision: 'approved' })}
            disabled={resolve.isPending}
            className="flex items-center gap-1 rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
          >
            <Icon name="check_circle" className="text-[16px]" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => resolve.mutate({ id: approval.id, decision: 'denied' })}
            disabled={resolve.isPending}
            className="flex items-center gap-1 rounded border border-error/30 bg-error-container px-space-md py-space-xs text-sm font-medium text-on-error-container disabled:opacity-50"
          >
            <Icon name="cancel" className="text-[16px]" />
            Deny
          </button>
        </div>
      )}
    </Card>
  );
}

function ResolvedRow({ approval }: { approval: ApprovalWithExpiry }) {
  const approved = approval.status === 'approved';
  return (
    <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 px-space-base py-space-sm opacity-70">
      <div className="flex items-center gap-space-sm">
        <Icon
          name={approved ? 'check_circle' : 'cancel'}
          className={`text-[18px] ${approved ? 'text-tertiary' : 'text-error'}`}
        />
        <span className="font-mono text-sm text-on-surface">{approval.tool}</span>
      </div>
      <StatusPill variant={approved ? 'allowed' : 'blocked'}>{approval.status}</StatusPill>
    </div>
  );
}

export function ApprovalsPage() {
  const { data: approvalList, isLoading } = useApprovals();

  const pending = approvalList?.filter((a) => a.status === 'pending') ?? [];
  const resolved = approvalList?.filter((a) => a.status !== 'pending') ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Approvals</h1>

      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col gap-space-base">
            {pending.length > 0 ? (
              pending.map((approval) => <PendingCard key={approval.id} approval={approval} />)
            ) : (
              <p className="text-on-surface-variant">No pending approvals.</p>
            )}
          </div>

          {resolved.length > 0 && (
            <div className="flex flex-col gap-space-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Recently resolved
              </h2>
              <div className="flex flex-col gap-space-xs">
                {resolved.slice(0, 10).map((approval) => (
                  <ResolvedRow key={approval.id} approval={approval} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
