import { formatLocalDate } from '../../utils/formatters';

export function SessionList({
  sessions,
  selectedSessionId,
  isLoading,
  pendingDeleteSessionId,
  onSelectSession,
  onDeleteSession,
}) {
  return (
    <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-3 shadow-panel">
      <div className="px-2 pb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          History
        </div>
        <h2 className="mt-2 text-lg font-semibold text-atlas-ink">Sessions</h2>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-5 text-sm text-atlas-slate">
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-mist px-4 py-5 text-sm text-atlas-slate">
          <div>No workout history yet. Start a session to see your progress here.</div>
          <a
            className="mt-3 inline-flex rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white"
            href="#"
          >
            Start a session
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isSelected = String(session.id) === String(selectedSessionId);
            const sessionDate = formatLocalDate(session.date, { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <article
                key={session.id}
                className={`rounded-2xl border px-4 py-4 ${
                  isSelected
                    ? 'border-atlas-accent bg-atlas-accentSoft text-white'
                    : 'border-atlas-line bg-atlas-mist text-atlas-ink'
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onSelectSession(String(session.id))}
                >
                  <div className={`text-xs uppercase tracking-[0.16em] ${isSelected ? 'text-blue-100' : 'text-atlas-slate'}`}>
                    {sessionDate}
                  </div>
                  <div className="mt-2 text-base font-semibold">{session.template_name}</div>
                  <div className={`mt-2 text-sm ${isSelected ? 'text-blue-100' : 'text-atlas-slate'}`}>
                    {session.has_logged_sets
                      ? `${session.exercise_count} exercises - ${Math.round(session.total_volume)} total volume`
                      : 'No sets logged'}
                  </div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs capitalize ${
                    session.status === 'completed'
                      ? 'bg-green-500/15 text-green-200'
                      : session.status === 'active'
                        ? 'bg-atlas-accent/20 text-blue-200'
                        : 'bg-zinc-700 text-zinc-200'
                  }`}
                  >
                    {session.status}
                  </div>
                </button>

                <button
                  type="button"
                  className="mt-3 w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 disabled:opacity-60"
                  disabled={pendingDeleteSessionId === session.id}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete ${session.template_name} on ${sessionDate}? This removes the entire session, all exercises, and all sets.`,
                    );

                    if (confirmed) {
                      void onDeleteSession(session.id);
                    }
                  }}
                >
                  {pendingDeleteSessionId === session.id ? 'Deleting...' : 'Delete session'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
