export function SessionList({
  sessions,
  selectedSessionId,
  isLoading,
  onSelectSession,
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
          No workout history yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isSelected = String(session.id) === String(selectedSessionId);

            return (
              <button
                key={session.id}
                type="button"
                className={`w-full rounded-2xl border px-4 py-4 text-left ${
                  isSelected
                    ? 'border-atlas-accent bg-atlas-accentSoft text-white'
                    : 'border-atlas-line bg-atlas-mist text-atlas-ink'
                }`}
                onClick={() => onSelectSession(String(session.id))}
              >
                <div className={`text-xs uppercase tracking-[0.16em] ${isSelected ? 'text-blue-100' : 'text-atlas-slate'}`}>
                  {session.date}
                </div>
                <div className="mt-2 text-base font-semibold">{session.template_name}</div>
                <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs capitalize ${
                  session.status === 'completed'
                    ? 'bg-green-500/15 text-green-200'
                    : session.status === 'active'
                      ? 'bg-atlas-accent/20 text-blue-200'
                      : 'bg-zinc-700 text-zinc-200'
                }`}>
                  {session.status}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
