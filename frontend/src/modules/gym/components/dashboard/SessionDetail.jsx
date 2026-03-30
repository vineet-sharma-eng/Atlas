function formatMetric(value) {
  return value ?? '--';
}

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
      <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
        Loading session detail...
      </section>
    );
  }

  if (!sessionDetail) {
    return (
      <section className="rounded-[22px] border border-dashed border-atlas-line bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
        Select a session to inspect exercises and logged sets.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          Session detail
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-atlas-ink">{sessionDetail.template_name}</h3>
        <div className="mt-2 inline-flex rounded-full border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-slate">
          {sessionDetail.date} - <span className="ml-1 capitalize">{sessionDetail.status}</span>
        </div>
      </div>

      <div className="space-y-3">
        {sessionDetail.exercises.map((exercise) => (
          <article
            key={exercise.session_exercise_id}
            className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold capitalize text-atlas-ink">
                  {exercise.exercise_name.replaceAll('_', ' ')}
                </h4>
                <div className="mt-2 text-xs uppercase tracking-[0.14em] text-atlas-slate">
                  {exercise.muscle_group || 'Accessory'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm text-atlas-ink"
                onClick={() => onSelectExercise(exercise.exercise_name)}
              >
                View history
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {exercise.sets.map((set) => (
                <div
                  key={set.id}
                  className="grid grid-cols-2 gap-2 rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3 text-sm sm:grid-cols-4"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Set</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{set.set_number}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Weight</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(set.weight)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Reps</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(set.reps)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">RIR</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(set.rir)}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
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
            <div className="mt-4 space-y-2">
              {exerciseHistory.map((row, index) => (
                <div
                  key={`${row.exercise_id}-${row.set_number}-${index}`}
                  className="grid grid-cols-2 gap-2 rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3 text-sm sm:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))]"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Date</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{row.date}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Set</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{row.set_number}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Weight</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(row.weight)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">Reps</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(row.reps)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">RIR</div>
                    <div className="mt-1 font-semibold text-atlas-ink">{formatMetric(row.rir)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
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
            <div className="mt-4 space-y-2">
              {exerciseProgress.map((row, index) => (
                <div key={`${row.date}-${index}`} className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">{row.date}</div>
                  <div className="mt-2 text-sm font-medium text-atlas-ink">
                    Weight {formatMetric(row.weight)} - Reps {formatMetric(row.reps)}
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
