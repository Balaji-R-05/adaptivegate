import type { Event, EventType } from '@adaptivegate/shared';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Sparkline } from '../components/Sparkline';
import { StatTile } from '../components/StatTile';
import { StatusPill, type StatusVariant } from '../components/StatusPill';
import { useEvents, useEventStats } from '../hooks/useEvents';
import { useIdentities } from '../hooks/useIdentities';

const EVENT_TYPES: EventType[] = [
  'tool_call',
  'policy_decision',
  'recovery_attempt',
  'approval_decision',
];

const TYPE_LABELS: Record<EventType, string> = {
  tool_call: 'Tool calls',
  policy_decision: 'Policy decisions',
  recovery_attempt: 'Recovery attempts',
  approval_decision: 'Approval decisions',
};

type VerdictFilter = 'all' | 'allowed' | 'blocked' | 'recovered' | 'pending';

function verdictOf(event: Event): { variant: StatusVariant; label: string } {
  const payload = event.payload as Record<string, unknown>;
  if (event.type === 'policy_decision' && (payload.verdict as { action?: string } | undefined)?.action === 'require_approval') {
    return { variant: 'pending', label: 'Pending approval' };
  }
  if (payload.blocked) return { variant: 'blocked', label: 'Blocked' };
  if (payload.recovered) return { variant: 'recovered', label: 'Recovered (retried)' };
  if (event.type === 'tool_call') return { variant: 'allowed', label: 'Allowed' };
  return { variant: 'neutral', label: 'Recorded' };
}

// One-line human summary of an event's payload — payload shape varies by
// type (see packages/db's event_type enum), so this is deliberately loose.
function summarize(event: Event): string {
  const payload = event.payload as Record<string, unknown>;
  const tool = typeof payload.tool === 'string' ? payload.tool : undefined;

  switch (event.type) {
    case 'tool_call':
      if (payload.blocked) {
        return `${tool ?? 'a tool'} blocked${
          typeof payload.reason === 'string' ? ` (${payload.reason})` : ''
        }`;
      }
      return `${tool ?? 'a tool'} called${payload.recovered ? ' (recovered after retry)' : ''}`;
    case 'policy_decision': {
      if (payload.kind === 'tool_definition_changed') {
        return `tool definition changed for ${tool ?? 'a tool'}`;
      }
      const verdict = payload.verdict as { action?: string } | undefined;
      return `policy ${verdict?.action ?? 'evaluated'} for ${tool ?? 'a tool'}`;
    }
    case 'recovery_attempt':
      return `recovered ${tool ?? 'a tool'} after ${String(payload.attempts ?? '?')} attempt(s)`;
    case 'approval_decision':
      return `approval decision for ${tool ?? 'a tool'}`;
    default:
      return event.type;
  }
}

export function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useEventStats();
  const { data: identities } = useIdentities();

  const [type, setType] = useState<EventType | 'all'>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: page, isLoading: eventsLoading } = useEvents({
    type: type === 'all' ? undefined : type,
    before: cursor,
    refetchInterval: autoRefresh ? 5000 : undefined,
  });

  useEffect(() => {
    if (!page) return;
    setEvents((prev) => (cursor ? [...prev, ...page] : page));
    // `cursor` deliberately excluded — this only reacts to a fresh page of
    // data for the current cursor/type, not to cursor changes themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleTypeChange(next: EventType | 'all') {
    setType(next);
    setCursor(undefined);
    setEvents([]);
  }

  function loadMore() {
    const oldest = events.at(-1);
    // .toISOString(), not .toString() — the `before` query param round-trips
    // through the server's listEventsQuerySchema (z.coerce.date()), and ISO
    // is the one unambiguous format to send back, now that createdAt is a
    // real Date (apiClient's reviveDates) rather than the raw ISO string it
    // used to be.
    if (oldest) setCursor(new Date(oldest.createdAt).toISOString());
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const payload = event.payload as Record<string, unknown>;
      const tool = typeof payload.tool === 'string' ? payload.tool.toLowerCase() : '';
      if (search && !tool.includes(search.toLowerCase())) return false;
      if (verdictFilter === 'all') return true;
      return verdictOf(event).variant === verdictFilter;
    });
  }, [events, search, verdictFilter]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-space-xl px-gutter-md py-space-lg">
      <div className="flex flex-col gap-space-base md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-space-xxs">
          <div className="flex items-center gap-space-sm">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">Overview</h1>
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-0.5 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary-container" />
              <span className="font-mono text-xs text-on-surface">Gateway active</span>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant">
            Real-time MCP telemetry, access policies, and agent resource bounds.
          </p>
        </div>
      </div>

      {statsLoading || !stats ? (
        <p className="text-on-surface-variant">Loading stats…</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total events"
            value={stats.total}
            icon="hub"
            iconColorClass="text-primary"
            footer={<Sparkline path="M1 17L12 13L24 15L36 8L48 10L63 2" colorClass="text-tertiary-container" />}
          />
          <StatTile
            label="Blocked"
            value={stats.blocked}
            icon="gpp_bad"
            iconColorClass="text-error"
            footer={<Sparkline path="M1 4L14 7L27 3L40 12L52 6L63 16" colorClass="text-error" />}
          />
          <StatTile
            label="Recovered"
            value={stats.recovered}
            icon="replay"
            iconColorClass="text-secondary"
            footer={<Sparkline path="M1 14L15 11L28 16L41 7L54 9L63 3" colorClass="text-secondary" />}
          />
          <StatTile
            label="Tool calls"
            value={stats.byType.tool_call ?? 0}
            icon="build"
            iconColorClass="text-tertiary"
            footer={<Sparkline path="M1 18L13 14L25 15L38 9L50 6L63 2" colorClass="text-primary-container" />}
          />
        </div>
      )}

      {identities && identities.length > 0 && (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">
              Active Agent Budgets
            </h2>
            <span className="rounded-lg bg-surface-container-low px-space-xs py-0.5 font-mono text-xs text-on-surface-variant">
              {identities.length} online
            </span>
          </div>
          <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
            {identities.map((identity) => {
              const hasLimit = identity.budgetLimit !== null;
              const pct = hasLimit
                ? Math.min(100, Math.round((identity.usedToday / identity.budgetLimit!) * 100))
                : 0;
              return (
                <Card key={identity.id} className="flex flex-col justify-between gap-space-md !p-0">
                  <div className="flex flex-col gap-space-xs p-space-base pb-0">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-surface-container-high px-space-xs py-0.5 font-mono text-[11px] text-on-surface">
                        {identity.enabled ? 'enabled' : 'disabled'}
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
                          'unlimited'
                        )}
                      </span>
                    </div>
                    {hasLimit && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                        <div
                          className={`h-full rounded-full ${pct >= 85 ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-b-xl bg-surface-container-low/50 px-space-base py-space-sm">
                    <span className="text-[11px] text-on-surface-variant">Tool Invocations</span>
                    <span className="font-mono text-xs font-semibold text-on-surface">
                      {identity.usedToday}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-space-md p-space-base lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">
              Recent Gateway Events
            </h2>
            <span className="rounded-full bg-surface-container-high px-space-xs py-0.5 text-[11px] font-semibold text-on-surface">
              Live Stream
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="relative flex min-w-[200px] items-center">
              <Icon
                name="search"
                className="pointer-events-none absolute left-space-sm text-[16px] text-on-surface-variant"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by tool…"
                className="w-full rounded-lg bg-surface-container-low py-1.5 pl-8 pr-space-sm text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container focus:outline-none"
              />
            </div>
            <select
              value={verdictFilter}
              onChange={(event) => setVerdictFilter(event.target.value as VerdictFilter)}
              className="rounded-lg bg-surface-container-low py-1.5 pl-space-md pr-8 text-sm text-on-surface focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
              <option value="recovered">Recovered</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={type}
              onChange={(event) => handleTypeChange(event.target.value as EventType | 'all')}
              className="rounded-lg bg-surface-container-low py-1.5 pl-space-md pr-8 text-sm text-on-surface focus:outline-none"
            >
              <option value="all">All event types</option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {TYPE_LABELS[eventType]}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-space-xs rounded-lg bg-surface-container-low px-space-sm py-1.5 select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-primary"
              />
              <span className="text-sm text-on-surface">Auto-refresh (5s)</span>
            </label>
          </div>
        </div>

        {eventsLoading && events.length === 0 ? (
          <p className="p-space-base text-on-surface-variant">Loading…</p>
        ) : filteredEvents.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider text-on-surface-variant">
                    <th className="w-3 py-2.5" />
                    <th className="px-space-base py-2.5">Timestamp</th>
                    <th className="px-space-base py-2.5">Event</th>
                    <th className="px-space-base py-2.5">Verdict</th>
                    <th className="px-space-base py-2.5">Type</th>
                    <th className="px-space-base py-2.5 text-right">Trace Hash</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredEvents.map((event) => {
                    const verdict = verdictOf(event);
                    return (
                      <tr key={event.id} className="group transition-colors hover:bg-surface-container-low">
                        <td className="p-0">
                          <div className={`h-10 w-1.5 rounded-r-sm ${
                            {
                              allowed: 'bg-tertiary-container',
                              blocked: 'bg-error',
                              recovered: 'bg-secondary',
                              pending: 'bg-secondary-container',
                              neutral: 'bg-outline-variant',
                            }[verdict.variant]
                          }`} />
                        </td>
                        <td className="px-space-base py-2.5 font-mono text-xs text-on-surface-variant">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-space-base py-2.5">
                          <span className="font-mono text-xs font-semibold text-on-surface">
                            {summarize(event)}
                          </span>
                        </td>
                        <td className="px-space-base py-2.5">
                          <StatusPill variant={verdict.variant}>{verdict.label}</StatusPill>
                        </td>
                        <td className="px-space-base py-2.5">
                          <span className="rounded bg-surface-container-high px-space-xs py-0.5 text-[11px] font-semibold text-on-surface-variant">
                            {TYPE_LABELS[event.type]}
                          </span>
                        </td>
                        <td className="px-space-base py-2.5 text-right">
                          <span
                            className="cursor-pointer rounded bg-surface-container-low px-space-xs py-0.5 font-mono text-xs text-on-surface-variant transition-colors group-hover:text-primary"
                            title="Click to copy hash"
                            onClick={() => void navigator.clipboard?.writeText(event.hash)}
                          >
                            {event.hash.slice(0, 8)}…
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-space-sm p-space-base sm:flex-row">
              <span className="text-sm text-on-surface-variant">
                Showing <strong className="font-semibold text-on-surface">{filteredEvents.length}</strong>{' '}
                of <strong className="font-semibold text-on-surface">{stats?.total ?? 0}</strong> events
              </span>
              {page && page.length > 0 && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={eventsLoading}
                  className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-md py-1.5 text-sm font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  <Icon name="expand_more" className="text-[16px]" />
                  {eventsLoading ? 'Loading…' : 'Load 50 more events'}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="p-space-base text-on-surface-variant">No events yet.</p>
        )}
      </Card>
    </div>
  );
}
