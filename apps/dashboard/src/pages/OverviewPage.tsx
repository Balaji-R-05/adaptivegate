import type { Event, EventType } from '@adaptivegate/shared';
import { useEffect, useState } from 'react';
import { useEvents, useEventStats } from '../hooks/useEvents';

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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
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
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Overview</h2>

      {statsLoading || !stats ? (
        <p className="mb-6 text-slate-500">Loading stats…</p>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total events" value={stats.total} />
          <StatTile label="Blocked" value={stats.blocked} />
          <StatTile label="Recovered" value={stats.recovered} />
          <StatTile label="Tool calls" value={stats.byType.tool_call ?? 0} />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">Recent events</h3>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Type
          <select
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as EventType | 'all')}
            className="rounded border border-slate-300 px-2 py-1"
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
        <p className="text-slate-500">Loading…</p>
      ) : events.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between rounded border border-slate-200 px-4 py-2"
              >
                <div>
                  <p className="text-sm text-slate-900">{summarize(event)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {TYPE_LABELS[event.type]}
                </span>
              </li>
            ))}
          </ul>
          {page && page.length > 0 && (
            <button
              type="button"
              onClick={loadMore}
              disabled={eventsLoading}
              className="mt-3 text-sm text-slate-600 disabled:opacity-50"
            >
              {eventsLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      ) : (
        <p className="text-slate-500">No events yet.</p>
      )}
    </section>
  );
}
