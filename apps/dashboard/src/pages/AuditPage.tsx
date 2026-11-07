import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { useEvents, useVerifyChain } from '../hooks/useEvents';

export function AuditPage() {
  const { data: events, isLoading } = useEvents({});
  const verify = useVerifyChain();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-space-lg px-gutter-md py-space-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-on-surface">
          Cryptographic Audit Trail
        </h1>
        <button
          type="button"
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
          className="flex items-center gap-1 rounded bg-primary px-space-md py-space-xs text-sm font-medium text-on-primary disabled:opacity-50"
        >
          <Icon name="verified" className="text-[16px]" />
          {verify.isPending ? 'Verifying…' : 'Verify chain'}
        </button>
      </div>

      {verify.data && (
        <Card
          className={
            verify.data.valid
              ? 'border-tertiary-container bg-surface-container-high'
              : 'border-error-container bg-error-container'
          }
        >
          <p className={`text-sm font-medium ${verify.data.valid ? 'text-tertiary' : 'text-on-error-container'}`}>
            {verify.data.valid
              ? `Chain verified — all ${verify.data.eventCount} events are untampered.`
              : `Chain verification FAILED across ${verify.data.eventCount} events — a stored row does not match its hash.`}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider text-on-surface-variant">
                <th className="px-space-base py-2.5">Timestamp</th>
                <th className="px-space-base py-2.5">Type</th>
                <th className="px-space-base py-2.5">Payload</th>
                <th className="px-space-base py-2.5 text-right">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-sm">
              {isLoading ? (
                <tr>
                  <td className="px-space-base py-space-base text-on-surface-variant" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : events && events.length > 0 ? (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-container-low">
                    <td className="px-space-base py-2.5 font-mono text-xs text-on-surface-variant">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-space-base py-2.5 font-mono text-xs text-primary">{event.type}</td>
                    <td className="max-w-md truncate px-space-base py-2.5 font-mono text-xs text-on-surface-variant">
                      {JSON.stringify(event.payload)}
                    </td>
                    <td className="px-space-base py-2.5 text-right font-mono text-xs text-on-surface-variant">
                      {event.hash.slice(0, 10)}…
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-space-base py-space-base text-on-surface-variant" colSpan={4}>
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
