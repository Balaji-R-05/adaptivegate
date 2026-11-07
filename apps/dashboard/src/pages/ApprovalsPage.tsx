import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { useApprovals, useResolveApproval, type ApprovalWithExpiry } from '../hooks/useApprovals';
import { useEventStats } from '../hooks/useEvents';
import { usePolicies } from '../hooks/usePolicies';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// `date` is typed Date (via the shared Approval schema's z.coerce.date()),
// but apiClient.get() never actually runs responses through Zod, so it's a
// raw JSON string at runtime — wrap with new Date(...) rather than trust
// the type (see PoliciesPage's identical bug/fix for the full story).
function formatRelativeTime(date: Date | string, now: Date): string {
  const diffMs = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function PendingCard({
  approval,
  now,
  selected,
  onToggleSelect,
}: {
  approval: ApprovalWithExpiry;
  now: Date;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const resolve = useResolveApproval();
  const remainingMs = new Date(approval.expiresAt).getTime() - now.getTime();

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <div
        className={`absolute bottom-0 left-0 top-0 w-1.5 ${
          approval.isExpired ? 'bg-outline-variant' : 'bg-secondary-container'
        }`}
      />
      <div className="flex flex-col gap-space-md p-space-base pl-space-lg">
        <div className="flex flex-col justify-between gap-space-sm lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-space-sm">
            {!approval.isExpired && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(approval.id)}
                className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-0"
              />
            )}
            <span className="rounded-lg bg-surface-container-low px-space-sm py-0.5 font-mono text-sm font-semibold text-on-surface">
              {approval.tool}
            </span>
          </div>
          <div className="flex items-center gap-space-md text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-space-xxs">
              <Icon name="schedule" className="text-[16px] text-secondary" />
              Requested {formatRelativeTime(approval.createdAt, now)}
            </span>
            <span className="text-outline-variant">•</span>
            {approval.isExpired ? (
              <StatusPill variant="neutral">Expired</StatusPill>
            ) : (
              <span className="font-mono font-semibold text-error">
                Expires in {formatCountdown(remainingMs)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-space-sm rounded-lg bg-surface-container-low p-space-sm text-sm md:grid-cols-3">
          <div className="flex flex-col gap-space-xxs">
            <span className="text-[11px] uppercase text-on-surface-variant">Agent Identity</span>
            <div className="flex items-center gap-space-xs">
              <Icon name="smart_toy" className="text-[16px] text-on-surface-variant" />
              <span className="truncate font-mono text-xs font-medium text-on-surface">
                {approval.identityId ?? 'default (unscoped key)'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-space-xxs">
            <span className="text-[11px] uppercase text-on-surface-variant">Target Server</span>
            <div className="flex items-center gap-space-xs">
              <Icon name="dns" className="text-[16px] text-on-surface-variant" />
              <span className="truncate font-mono text-xs font-medium text-on-surface">
                {approval.serverId}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-space-xxs">
            <span className="text-[11px] uppercase text-on-surface-variant">Triggered Policy Rule</span>
            <div className="flex items-center gap-space-xs text-error">
              <Icon name="gpp_bad" className="text-[16px]" />
              <span className="truncate font-medium">{approval.ruleName}</span>
            </div>
          </div>
        </div>

        {approval.argumentsRedacted && (
          <div className="flex flex-col gap-space-xxs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase text-on-surface-variant">
                Invocation Arguments (Sanitized)
              </span>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(JSON.stringify(approval.argumentsRedacted, null, 2))
                }
                className="flex items-center gap-space-xxs text-[11px] text-on-surface-variant hover:text-on-surface"
              >
                <Icon name="content_copy" className="text-[14px]" />
                Copy JSON
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg bg-inverse-surface p-space-sm shadow-inner">
              <pre className="font-mono text-xs text-inverse-on-surface">
                {JSON.stringify(approval.argumentsRedacted, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!approval.isExpired && (
          <div className="flex items-center justify-end gap-space-sm pt-space-xs">
            <button
              type="button"
              onClick={() => resolve.mutate({ id: approval.id, decision: 'denied' })}
              disabled={resolve.isPending}
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-md py-space-xs text-sm font-semibold text-error shadow-sm transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
            >
              <Icon name="cancel" className="text-[16px]" />
              Deny Request
            </button>
            <button
              type="button"
              onClick={() => resolve.mutate({ id: approval.id, decision: 'approved' })}
              disabled={resolve.isPending}
              className="flex items-center gap-space-xs rounded-lg bg-tertiary px-space-md py-space-xs text-sm font-semibold text-on-tertiary shadow-sm transition-colors hover:bg-tertiary-container disabled:opacity-50"
            >
              <Icon name="check_circle" className="text-[16px]" />
              Approve Execution
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResolvedRow({ approval, now }: { approval: ApprovalWithExpiry; now: Date }) {
  const approved = approval.status === 'approved';
  const icon = approved ? 'check_circle' : 'cancel';
  const iconColor = approved ? 'text-tertiary' : 'text-error';
  const badgeBg = approved ? 'bg-tertiary-container/40 text-tertiary' : 'bg-error-container text-on-error-container';

  return (
    <div className="flex flex-col justify-between gap-space-base p-space-base transition-colors hover:bg-surface-container-low md:flex-row md:items-center">
      <div className="flex min-w-0 items-start gap-space-md md:items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
          <Icon name={icon} className={`text-[18px] ${iconColor}`} />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="truncate font-mono text-sm font-medium text-on-surface">{approval.tool}</span>
            <span className={`rounded px-space-xs py-0.5 text-[11px] font-medium ${badgeBg}`}>
              {approved ? 'Authorized' : 'Rejected'}
            </span>
          </div>
          <div className="mt-space-xxs flex flex-wrap items-center gap-space-xs text-xs text-on-surface-variant">
            <span>
              Agent: <strong className="font-normal text-on-surface">{approval.identityId ?? 'default'}</strong>
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-mono">Rule: {approval.ruleName}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-space-sm self-end text-[11px] text-on-surface-variant md:self-auto">
        <Icon name="timer" className="text-[14px]" />
        <span>{approval.decidedAt ? formatRelativeTime(approval.decidedAt, now) : ''}</span>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const { data: approvalList, isLoading } = useApprovals();
  const { data: eventStats } = useEventStats();
  const { data: policyList } = usePolicies();
  const resolve = useResolveApproval();

  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pending = (approvalList?.filter((a) => a.status === 'pending' && !a.isExpired) ?? []).sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  );
  const expired = approvalList?.filter((a) => a.status === 'pending' && a.isExpired) ?? [];
  const resolved = (approvalList?.filter((a) => a.status !== 'pending') ?? []).sort(
    (a, b) =>
      (b.decidedAt ? new Date(b.decidedAt).getTime() : 0) - (a.decidedAt ? new Date(a.decidedAt).getTime() : 0),
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === pending.length ? new Set() : new Set(pending.map((a) => a.id))));
  }

  async function resolveSelected(decision: 'approved' | 'denied') {
    await Promise.all([...selected].map((id) => resolve.mutateAsync({ id, decision })));
    setSelected(new Set());
  }

  const toolCallCount = eventStats?.byType.tool_call ?? 0;
  const interceptRate =
    toolCallCount > 0 ? (((eventStats?.blocked ?? 0) + pending.length) / toolCallCount) * 100 : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex flex-col justify-between gap-space-base pb-space-xs md:flex-row md:items-center">
        <div className="flex flex-col gap-space-xxs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
              Human-in-the-Loop Approvals
            </h1>
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-0.5 text-[11px] text-secondary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary-container" />
              <span>{pending.length} Pending Review</span>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Tool execution requests paused by policy, awaiting manual authorization. Unresolved requests
            expire automatically.
          </p>
        </div>
        {pending.length > 0 && (
          <div className="flex items-center gap-space-sm self-start rounded-xl bg-surface-container-lowest p-space-xs shadow-sm md:self-auto">
            <label className="flex cursor-pointer items-center gap-space-xs px-space-sm py-space-xs text-sm text-on-surface-variant select-none">
              <input
                type="checkbox"
                checked={selected.size === pending.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-0"
              />
              <span>Select All ({pending.length})</span>
            </label>
            <div className="h-4 w-px bg-surface-container-highest" />
            <button
              type="button"
              onClick={() => void resolveSelected('approved')}
              disabled={selected.size === 0 || resolve.isPending}
              className="flex items-center gap-space-xs rounded-lg bg-tertiary px-space-md py-space-xs text-sm font-medium text-on-tertiary shadow-sm transition-colors hover:bg-tertiary-container disabled:opacity-50"
            >
              <Icon name="done_all" className="text-[16px]" />
              Approve Selected
            </button>
            <button
              type="button"
              onClick={() => void resolveSelected('denied')}
              disabled={selected.size === 0 || resolve.isPending}
              className="flex items-center gap-space-xs rounded-lg bg-surface-container text-error px-space-md py-space-xs text-sm font-medium transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
            >
              <Icon name="close" className="text-[16px]" />
              Deny Selected
            </button>
          </div>
        )}
      </div>

      {!isLoading && (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-3">
          <Card className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                Gateway Intercept Rate
              </span>
              <span className="mt-space-xxs font-sans text-xl font-semibold text-on-surface">
                {interceptRate.toFixed(1)}%
              </span>
              <span className="mt-space-xxs text-xs text-on-surface-variant">
                {(eventStats?.blocked ?? 0) + pending.length} of {toolCallCount} tool calls
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-secondary">
              <Icon name="shield" className="text-[20px]" />
            </div>
          </Card>
          <Card className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                Policies Configured
              </span>
              <span className="mt-space-xxs font-sans text-xl font-semibold text-on-surface">
                {policyList?.length ?? 0}
              </span>
              <span className="mt-space-xxs text-xs text-on-surface-variant">
                Latest policy governs new calls
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
              <Icon name="verified_user" className="text-[20px]" />
            </div>
          </Card>
          <Card className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                Expired Unresolved
              </span>
              <span className="mt-space-xxs font-sans text-xl font-semibold text-on-surface">
                {expired.length}
              </span>
              <span className="mt-space-xxs text-xs text-on-surface-variant">Never reviewed in time</span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-primary">
              <Icon name="timer" className="text-[20px]" />
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-space-base">
        <div className="flex items-center justify-between px-space-xs">
          <span className="flex items-center gap-space-xs text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            <Icon name="pending_actions" className="text-[16px]" />
            Live Intercept Queue
          </span>
          <span className="font-mono text-xs text-on-surface-variant">Auto-refresh: 5s</span>
        </div>

        {isLoading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : pending.length > 0 ? (
          pending.map((approval) => (
            <PendingCard
              key={approval.id}
              approval={approval}
              now={now}
              selected={selected.has(approval.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        ) : (
          <p className="text-on-surface-variant">No pending approvals.</p>
        )}

        {expired.map((approval) => (
          <PendingCard key={approval.id} approval={approval} now={now} selected={false} onToggleSelect={() => {}} />
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="mt-space-2xl flex flex-col gap-space-base">
          <div className="flex items-center gap-space-sm px-space-xs">
            <span className="flex items-center gap-space-xs text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              <Icon name="history" className="text-[16px]" />
              Recently Resolved Approvals
            </span>
          </div>
          <Card className="divide-y divide-outline-variant/30 overflow-hidden !p-0">
            {resolved.slice(0, 15).map((approval) => (
              <ResolvedRow key={approval.id} approval={approval} now={now} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
