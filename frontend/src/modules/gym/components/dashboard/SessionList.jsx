export function SessionList({
  sessions,
  selectedSessionId,
  isLoading,
  onSelectSession,
}) {
  return (
    <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel shadow-panel">
      <div className="border-b border-atlas-line/70 px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          History
        </div>
        <h2 className="mt-2 text-lg font-semibold text-atlas-ink">Sessions</h2>
      </div>

      <div className="max-h-[720px] overflow-y-auto p-3">
        {isLoading ? (
          <div className="rounded-2xl border border-atlas-line bg-white px-4 py-5 text-sm text-atlas-slate">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-atlas-line bg-white px-4 py-5 text-sm text-atlas-slate">
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
                      ? 'border-atlas-night bg-atlas-night text-white'
                      : 'border-atlas-line bg-white text-atlas-ink'
                  }`}
                  onClick={() => onSelectSession(String(session.id))}
                >
                  <div className={`text-xs uppercase tracking-[0.16em] ${isSelected ? 'text-white/70' : 'text-atlas-slate'}`}>
                    {session.date}
                  </div>
                  <div className="mt-2 text-base font-semibold">{session.template_name}</div>
                  <div className={`mt-2 text-sm capitalize ${isSelected ? 'text-white/80' : 'text-atlas-slate'}`}>
                    {session.status}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
