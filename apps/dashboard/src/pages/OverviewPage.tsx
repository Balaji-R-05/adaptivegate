import type { Event, EventType } from '@adaptivegate/shared';
import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/StatTile';
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

function eventIndicatorColor(event: Event): string {
  const payload = event.payload as Record<string, unknown>;
  if (payload.blocked) return 'bg-error';
  if (payload.recovered) return 'bg-secondary';
  return 'bg-tertiary-container';
}

export function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useEventStats();
  const { data: identities } = useIdentities();

  const [type, setType] = useState<EventType | 'all'>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);

  const { data: page, isLoading: eventsLoading } = useEvents({
    type: type === 'all' ? undefined : type,
    before: cursor,
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
    if (oldest) setCursor(oldest.createdAt.toString());
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-space-xl px-gutter-md py-space-lg">
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

      {statsLoading || !stats ? (
        <p className="text-on-surface-variant">Loading stats…</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total events" value={stats.total} icon="hub" iconColorClass="text-primary" />
          <StatTile label="Blocked" value={stats.blocked} icon="gpp_bad" iconColorClass="text-error" />
          <StatTile
            label="Recovered"
            value={stats.recovered}
            icon="replay"
            iconColorClass="text-secondary"
          />
          <StatTile
            label="Tool calls"
            value={stats.byType.tool_call ?? 0}
            icon="build"
            iconColorClass="text-tertiary"
          />
        </div>
      )}

      {identities && identities.length > 0 && (
        <div className="flex flex-col gap-space-md">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">
            Agent Budgets
          </h2>
          <div className="grid grid-cols-1 gap-space-base sm:grid-cols-2 lg:grid-cols-4">
            {identities.map((identity) => (
              <Card key={identity.id} className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate font-semibold text-on-surface">{identity.name}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${identity.enabled ? 'bg-tertiary-container' : 'bg-error'}`}
                  />
                </div>
                <span className="text-xs text-on-surface-variant">
                  Budget: {identity.budgetLimit ? `${identity.budgetLimit}/day` : 'unlimited'}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col items-start justify-between gap-space-md p-space-base lg:flex-row lg:items-center">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-on-surface">
            Recent Gateway Events
          </h2>
          <label className="flex items-center gap-space-sm text-sm text-on-surface-variant">
            Type
            <select
              value={type}
              onChange={(event) => handleTypeChange(event.target.value as EventType | 'all')}
              className="rounded-lg bg-surface-container-low px-space-sm py-1.5 text-sm text-on-surface"
            >
              <option value="all">All</option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {TYPE_LABELS[eventType]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {eventsLoading && events.length === 0 ? (
          <p className="p-space-base text-on-surface-variant">Loading…</p>
        ) : events.length > 0 ? (
          <>
            <table className="w-full border-collapse text-left">
              <tbody className="divide-y divide-outline-variant/30 text-sm">
                {events.map((event) => (
                  <tr key={event.id} className="group transition-colors hover:bg-surface-container-low">
                    <td className="w-1.5 p-0">
                      <div className={`h-10 w-1.5 rounded-r-sm ${eventIndicatorColor(event)}`} />
                    </td>
                    <td className="px-space-base py-2.5 font-mono text-xs text-on-surface-variant">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-space-base py-2.5">
                      <p className="text-on-surface">{summarize(event)}</p>
                    </td>
                    <td className="px-space-base py-2.5 text-right">
                      <span className="rounded bg-surface-container-high px-space-xs py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        {TYPE_LABELS[event.type]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {page && page.length > 0 && (
              <div className="flex justify-center p-space-base">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={eventsLoading}
                  className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-md py-1.5 text-sm font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-50"
                >
                  <Icon name="expand_more" className="text-[16px]" />
                  {eventsLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="p-space-base text-on-surface-variant">No events yet.</p>
        )}
      </Card>
    </div>
  );
}
