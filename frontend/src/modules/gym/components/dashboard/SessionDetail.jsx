export function SessionDetail({
  sessionDetail,
  selectedExerciseName,
  exerciseHistory,
  exerciseProgress,
  isLoadingSessionDetail,
  isLoadingExerciseHistory,
  onSelectExercise,
}) {
  if (isLoadingSessionDetail) {
    return (
      <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
        Loading session detail...
      </section>
    );
  }

  if (!sessionDetail) {
    return (
      <section className="rounded-[24px] border border-dashed border-atlas-line bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
        Select a session to inspect exercises and logged sets.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          Session detail
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-atlas-ink">{sessionDetail.template_name}</h3>
        <div className="mt-2 text-sm text-atlas-slate">
          {sessionDetail.date} • <span className="capitalize">{sessionDetail.status}</span>
        </div>
      </div>

      <div className="space-y-3">
        {sessionDetail.exercises.map((exercise) => (
          <article key={exercise.session_exercise_id} className="rounded-2xl border border-atlas-line bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-lg font-semibold capitalize text-atlas-ink">
                  {exercise.exercise_name.replaceAll('_', ' ')}
                </h4>
                <div className="mt-2 text-sm uppercase tracking-[0.14em] text-atlas-slate">
                  {exercise.muscle_group || 'Accessory'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm text-atlas-ink"
                onClick={() => onSelectExercise(exercise.exercise_name)}
              >
                View history
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-atlas-line text-left text-xs uppercase tracking-[0.16em] text-atlas-slate">
                    <th className="px-3 py-2">Set</th>
                    <th className="px-3 py-2">Weight</th>
                    <th className="px-3 py-2">Reps</th>
                    <th className="px-3 py-2">RIR</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.sets.map((set) => (
                    <tr key={set.id} className="border-b border-atlas-line/50 last:border-b-0">
                      <td className="px-3 py-2">{set.set_number}</td>
                      <td className="px-3 py-2">{set.weight ?? '—'}</td>
                      <td className="px-3 py-2">{set.reps ?? '—'}</td>
                      <td className="px-3 py-2">{set.rir ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
            Exercise history
          </div>
          <h4 className="mt-2 text-lg font-semibold capitalize text-atlas-ink">
            {selectedExerciseName ? selectedExerciseName.replaceAll('_', ' ') : 'Select an exercise'}
          </h4>

          {isLoadingExerciseHistory ? (
            <div className="mt-4 text-sm text-atlas-slate">Loading exercise history...</div>
          ) : exerciseHistory.length === 0 ? (
            <div className="mt-4 text-sm text-atlas-slate">No prior history for this exercise.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-atlas-line text-left text-xs uppercase tracking-[0.16em] text-atlas-slate">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Set</th>
                    <th className="px-3 py-2">Weight</th>
                    <th className="px-3 py-2">Reps</th>
                    <th className="px-3 py-2">RIR</th>
                  </tr>
                </thead>
                <tbody>
                  {exerciseHistory.map((row, index) => (
                    <tr key={`${row.exercise_id}-${row.set_number}-${index}`} className="border-b border-atlas-line/50 last:border-b-0">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.set_number}</td>
                      <td className="px-3 py-2">{row.weight ?? '—'}</td>
                      <td className="px-3 py-2">{row.reps ?? '—'}</td>
                      <td className="px-3 py-2">{row.rir ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
            Last 3 sessions
          </div>
          <h4 className="mt-2 text-lg font-semibold capitalize text-atlas-ink">
            Progress snapshot
          </h4>

          {isLoadingExerciseHistory ? (
            <div className="mt-4 text-sm text-atlas-slate">Loading progress...</div>
          ) : exerciseProgress.length === 0 ? (
            <div className="mt-4 text-sm text-atlas-slate">No progress rows available yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {exerciseProgress.map((row, index) => (
                <div key={`${row.date}-${index}`} className="rounded-2xl border border-atlas-line bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-atlas-slate">{row.date}</div>
                  <div className="mt-2 text-sm text-atlas-ink">
                    Weight: {row.weight ?? '—'} • Reps: {row.reps ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
