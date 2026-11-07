import type { Event, EventType } from '@adaptivegate/shared';
import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatusPill, type StatusVariant } from '../components/StatusPill';
import { useEvents, useEventStats, useVerifyChain } from '../hooks/useEvents';

const EVENT_TYPES: EventType[] = [
  'tool_call',
  'policy_decision',
  'recovery_attempt',
  'approval_decision',
];

const TYPE_ICON: Record<EventType, string> = {
  tool_call: 'bolt',
  policy_decision: 'policy',
  recovery_attempt: 'healing',
  approval_decision: 'gpp_maybe',
};

type VerdictFilter = 'all' | 'allowed' | 'blocked' | 'recovered' | 'pending';

function verdictOf(event: Event): { variant: StatusVariant; label: string } {
  const payload = event.payload as Record<string, unknown>;
  if (
    event.type === 'policy_decision' &&
    (payload.verdict as { action?: string } | undefined)?.action === 'require_approval'
  ) {
    return { variant: 'pending', label: 'Pending approval' };
  }
  if (payload.blocked) return { variant: 'blocked', label: 'Blocked' };
  if (payload.recovered) return { variant: 'recovered', label: 'Recovered' };
  if (event.type === 'tool_call') return { variant: 'allowed', label: 'Allowed' };
  if (event.type === 'approval_decision') {
    return payload.decision === 'approved'
      ? { variant: 'allowed', label: 'Approved' }
      : { variant: 'blocked', label: 'Denied' };
  }
  return { variant: 'neutral', label: 'Recorded' };
}

// Short "server:tool" + a one-line detail, reusing the real payload fields
// only — no fabricated latency/risk-score/signature data (the mockup this
// page is ported from invents a Merkle/ECDSA proof system; this gateway's
// real audit log is a plain SHA-256 previousHash chain, so that framing —
// block height, enclave attestation, per-row "Verified" badges — is
// deliberately not replicated here. The only real, chain-wide check is
// GET /api/events/verify, surfaced by the Verify Chain button below).
function targetOf(event: Event): string {
  const payload = event.payload as Record<string, unknown>;
  const tool = typeof payload.tool === 'string' ? payload.tool : undefined;
  if (!tool) return event.type;
  const serverId = typeof payload.serverId === 'string' ? payload.serverId.slice(0, 8) : undefined;
  return serverId ? `${serverId}…:${tool}` : tool;
}

function summaryOf(event: Event): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'tool_call':
      if (payload.blocked) return `reason: ${String(payload.reason ?? 'policy')}`;
      return payload.recovered
        ? `recovered after ${String(payload.attempts ?? '?')} attempt(s)`
        : `attempts: ${String(payload.attempts ?? 1)}`;
    case 'policy_decision': {
      if (payload.kind === 'tool_definition_changed') return 'tool definition changed since last sync';
      const verdict = payload.verdict as { action?: string; ruleName?: string } | undefined;
      return `${verdict?.action ?? 'evaluated'} (rule: ${verdict?.ruleName ?? '—'})`;
    }
    case 'recovery_attempt':
      return `${String(payload.attempts ?? '?')} attempt(s) before success`;
    case 'approval_decision':
      return `decision: ${String(payload.decision ?? '—')}`;
    default:
      return '';
  }
}

export function AuditPage() {
  const { data: stats } = useEventStats();
  const [type, setType] = useState<EventType | 'all'>('all');
  const { data: events, isLoading } = useEvents({ type: type === 'all' ? undefined : type });
  const verify = useVerifyChain();

  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');

  const filteredEvents = useMemo(() => {
    return (events ?? []).filter((event) => {
      const payload = event.payload as Record<string, unknown>;
      const tool = typeof payload.tool === 'string' ? payload.tool.toLowerCase() : '';
      const identityId = typeof payload.identityId === 'string' ? payload.identityId.toLowerCase() : '';
      if (search && !tool.includes(search.toLowerCase()) && !identityId.includes(search.toLowerCase())) {
        return false;
      }
      if (verdictFilter === 'all') return true;
      return verdictOf(event).variant === verdictFilter;
    });
  }, [events, search, verdictFilter]);

  function exportVisibleAsJson() {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex flex-col gap-space-base md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-space-xxs">
          <span className="w-fit rounded-lg bg-surface-container-high px-space-xs py-0.5 font-mono text-[11px] uppercase tracking-wider text-primary">
            Audit Log
          </span>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
            Cryptographic Audit Trail
          </h1>
          <p className="max-w-3xl text-sm text-on-surface-variant">
            Append-only, hash-chained log of every tool call, policy decision, recovery attempt and
            approval. Each row's hash is a SHA-256 digest of its fields plus the previous row's
            hash — tampering with any stored row breaks every hash after it.
          </p>
        </div>
      </div>

      <Card
        className={
          verify.data
            ? verify.data.valid
              ? 'border-tertiary-container bg-surface-container-lowest'
              : 'border-error-container bg-error-container'
            : 'bg-surface-container-lowest'
        }
      >
        <div className="flex flex-col items-start justify-between gap-space-base lg:flex-row lg:items-center">
          <div className="flex items-start gap-space-base">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                verify.data ? (verify.data.valid ? 'bg-tertiary-container/10 text-tertiary' : 'bg-error-container text-error') : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              <Icon name="verified_user" className="text-[28px]" />
            </div>
            <div className="flex flex-col gap-space-xxs">
              {verify.data ? (
                <span
                  className={`inline-flex w-fit items-center gap-1 rounded-full px-space-sm py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                    verify.data.valid ? 'bg-tertiary-container/20 text-tertiary' : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${verify.data.valid ? 'bg-tertiary' : 'bg-error'}`} />
                  Chain integrity: {verify.data.valid ? 'VERIFIED' : 'FAILED'}
                </span>
              ) : (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-container-high px-space-sm py-0.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Not verified yet
                </span>
              )}
              <p className="text-sm text-on-surface-variant">
                {verify.data
                  ? `${verify.data.eventCount} events checked against their stored hashes.`
                  : "Click Verify Chain to recompute every event's hash and check it against what's stored."}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-space-sm">
            <button
              type="button"
              onClick={() => verify.mutate()}
              disabled={verify.isPending}
              className="flex h-9 items-center gap-1 rounded-lg bg-surface-container px-space-base text-sm font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container-highest disabled:opacity-50"
            >
              <Icon name="sync" className={`text-[18px] ${verify.isPending ? 'animate-spin' : ''}`} />
              {verify.isPending ? 'Verifying…' : 'Verify chain'}
            </button>
            <button
              type="button"
              onClick={exportVisibleAsJson}
              disabled={filteredEvents.length === 0}
              className="flex h-9 items-center gap-1 rounded-lg bg-primary px-space-base text-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
            >
              <Icon name="download" className="text-[18px]" />
              Export visible as JSON
            </button>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col items-stretch gap-space-sm !p-space-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col items-center gap-space-sm sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Icon
              name="search"
              className="pointer-events-none absolute left-space-sm top-1/2 -translate-y-1/2 text-[18px] text-outline"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by tool or identity…"
              className="h-9 w-full rounded-lg bg-surface-container-low pl-9 pr-space-base font-mono text-sm text-on-surface placeholder:text-outline focus:bg-surface-container focus:outline-none"
            />
          </div>
          <select
            value={verdictFilter}
            onChange={(event) => setVerdictFilter(event.target.value as VerdictFilter)}
            className="h-9 rounded-lg bg-surface-container-low px-space-sm text-sm text-on-surface focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="allowed">Allowed</option>
            <option value="blocked">Blocked</option>
            <option value="recovered">Recovered</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as EventType | 'all')}
            className="h-9 rounded-lg bg-surface-container-low px-space-sm text-sm text-on-surface focus:outline-none"
          >
            <option value="all">All event types</option>
            {EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-space-base py-2.5">Timestamp</th>
                <th className="px-space-base py-2.5">Event Type</th>
                <th className="px-space-base py-2.5">Identity</th>
                <th className="px-space-base py-2.5">Server &amp; Tool</th>
                <th className="px-space-base py-2.5">Summary</th>
                <th className="px-space-base py-2.5">Status</th>
                <th className="px-space-base py-2.5 text-right">Hash</th>
              </tr>
            </thead>
            <tbody className="text-on-surface text-xs">
              {isLoading ? (
                <tr>
                  <td className="px-space-base py-space-base text-on-surface-variant" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : filteredEvents.length > 0 ? (
                filteredEvents.map((event) => {
                  const verdict = verdictOf(event);
                  const payload = event.payload as Record<string, unknown>;
                  const identityId = typeof payload.identityId === 'string' ? payload.identityId : null;
                  return (
                    <tr key={event.id} className="group transition-colors hover:bg-surface-container-low/70">
                      <td className="whitespace-nowrap px-space-base py-2.5 text-on-surface-variant">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-space-base py-2.5">
                        <span className="inline-flex items-center gap-1 rounded bg-primary-container/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Icon name={TYPE_ICON[event.type]} className="text-[13px]" />
                          {event.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-space-base py-2.5">
                        <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
                          {identityId ? `${identityId.slice(0, 8)}…` : 'default'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-space-base py-2.5 font-medium">{targetOf(event)}</td>
                      <td className="max-w-xs truncate px-space-base py-2.5 text-on-surface-variant">
                        {summaryOf(event)}
                      </td>
                      <td className="whitespace-nowrap px-space-base py-2.5">
                        <StatusPill variant={verdict.variant}>{verdict.label}</StatusPill>
                      </td>
                      <td className="whitespace-nowrap px-space-base py-2.5 text-right">
                        <span
                          className="cursor-pointer rounded bg-surface-container-low px-space-xs py-0.5 text-outline transition-colors group-hover:text-primary"
                          title="Click to copy full hash"
                          onClick={() => void navigator.clipboard?.writeText(event.hash)}
                        >
                          {event.hash.slice(0, 8)}…{event.hash.slice(-4)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-space-base py-space-base text-on-surface-variant" colSpan={7}>
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-space-sm px-space-base py-space-sm sm:flex-row">
          <span className="font-mono text-xs text-on-surface-variant">
            Displaying <strong className="text-on-surface">{filteredEvents.length}</strong> of{' '}
            <strong className="text-on-surface">{stats?.total ?? events?.length ?? 0}</strong> audit entries
          </span>
        </div>
      </Card>
    </div>
  );
}
