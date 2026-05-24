import { useEffect, useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import { formatExerciseName, formatLocalDate } from '../../utils/formatters';

function formatMetric(value) {
  return value ?? '--';
}

export function SessionDetail({
  sessionDetail,
  isOpen,
  isLoadingSessionDetail,
  pendingDeleteSessionId,
  pendingDeleteSessionExerciseId,
  exerciseInsightById,
  loadingExerciseInsightById,
  exerciseInsightErrorById,
  onClose,
  onDeleteSession,
  onDeleteSessionExercise,
  onLoadExerciseInsight,
}) {
  const [expandedExerciseIds, setExpandedExerciseIds] = useState({});
  const [mobileSelectedExerciseId, setMobileSelectedExerciseId] = useState(null);
  const isDesktop = useMinWidthMatch('(min-width: 768px)');
  const shouldRenderMobileDetail = isOpen || isLoadingSessionDetail || Boolean(sessionDetail);
  const mobileSelectedExercise = sessionDetail?.exercises.find(
    (exercise) => exercise.session_exercise_id === mobileSelectedExerciseId,
  ) || null;
  const mobileInsightKey = getExerciseInsightKey(mobileSelectedExercise);

  useEffect(() => {
    if (!sessionDetail || !isDesktop) {
      setExpandedExerciseIds({});
      return;
    }

    setExpandedExerciseIds(
      Object.fromEntries(
        sessionDetail.exercises.map((exercise) => [exercise.session_exercise_id, true]),
      ),
    );
    setMobileSelectedExerciseId(null);
  }, [isDesktop, sessionDetail]);

  useEffect(() => {
    if (!sessionDetail) {
      return;
    }

    Object.entries(expandedExerciseIds).forEach(([sessionExerciseId, isExpanded]) => {
      if (!isExpanded) {
        return;
      }

      const exercise = sessionDetail.exercises.find(
        (candidate) => candidate.session_exercise_id === Number(sessionExerciseId),
      );

      if (exercise?.effective_exercise_id) {
        void onLoadExerciseInsight(exercise);
      }
    });

    if (mobileSelectedExercise?.effective_exercise_id) {
      void onLoadExerciseInsight(mobileSelectedExercise);
    }
  }, [expandedExerciseIds, mobileSelectedExercise, onLoadExerciseInsight, sessionDetail]);

  const detailBody = isLoadingSessionDetail ? (
    <div className="p-2 text-sm text-atlas-slate">Loading session detail...</div>
  ) : !sessionDetail ? (
    <div className="p-2 text-sm text-atlas-slate">
      Select a session to inspect exercises and logged sets.
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-atlas-line/80 pb-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
            Session detail
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-atlas-ink">{sessionDetail.template_name}</h3>
          <div className="mt-2 text-sm text-atlas-slate">
            {formatLocalDate(sessionDetail.date, { month: 'short', day: 'numeric', year: 'numeric' })}
            {' - '}
            {sessionDetail.has_logged_sets ? `${sessionDetail.exercise_count} exercises` : 'No sets logged'}
          </div>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 disabled:opacity-60"
          disabled={pendingDeleteSessionId === sessionDetail.id}
          onClick={() => {
            const confirmed = window.confirm(
              `Delete ${sessionDetail.template_name} on ${formatLocalDate(sessionDetail.date, { month: 'short', day: 'numeric', year: 'numeric' })}? This removes the entire session, all exercises, and all sets.`,
            );

            if (confirmed) {
              void onDeleteSession(sessionDetail.id).then(() => onClose());
            }
          }}
        >
          {pendingDeleteSessionId === sessionDetail.id ? 'Deleting...' : 'Delete session'}
        </button>
      </div>

      {sessionDetail.exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-mist px-4 py-5 text-sm text-atlas-slate">
          No exercises logged in this session.
        </div>
      ) : (
        <div className="space-y-3">
          {sessionDetail.exercises.map((exercise) => {
            const isExpanded = isDesktop || expandedExerciseIds[exercise.session_exercise_id] === true;
            const insightKey = getExerciseInsightKey(exercise);

            return (
              <article
                key={exercise.session_exercise_id}
                className="rounded-[22px] border border-atlas-line/80 bg-atlas-night px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (isDesktop) {
                        return;
                      }

                      setMobileSelectedExerciseId(exercise.session_exercise_id);
                    }}
                  >
                    <div className={`${isExpanded ? 'whitespace-normal' : 'truncate'} text-lg font-semibold text-atlas-ink`}>
                      {formatExerciseName(exercise.exercise_name)}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.14em] text-atlas-slate">
                      {exercise.muscle_group || 'Accessory'}
                    </div>
                  </button>

                  <button
                    type="button"
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
                    disabled={pendingDeleteSessionExerciseId === exercise.session_exercise_id}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Delete ${formatExerciseName(exercise.exercise_name)} from this session? This removes the exercise and all of its sets from history.`,
                      );

                      if (confirmed) {
                        void onDeleteSessionExercise(exercise.session_exercise_id);
                      }
                    }}
                  >
                    {pendingDeleteSessionExerciseId === exercise.session_exercise_id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="mt-4 hidden space-y-3 md:block">
                    <ExerciseDetailContent
                      exercise={exercise}
                      insight={exerciseInsightById[insightKey] || null}
                      isLoading={loadingExerciseInsightById[insightKey] === true}
                      error={exerciseInsightErrorById[insightKey] || ''}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden md:block">
        <section className="flex h-full flex-col rounded-[22px] border border-atlas-line/80 bg-atlas-panel shadow-panel">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {detailBody}
          </div>
        </section>
      </div>

      <BottomSheet
        open={!isDesktop && shouldRenderMobileDetail}
        title={sessionDetail ? sessionDetail.template_name : 'Session detail'}
        onClose={onClose}
      >
        {detailBody}
      </BottomSheet>

      <BottomSheet
        open={Boolean(mobileSelectedExercise)}
        title={mobileSelectedExercise ? formatExerciseName(mobileSelectedExercise.exercise_name) : 'Exercise detail'}
        onClose={() => setMobileSelectedExerciseId(null)}
      >
        {mobileSelectedExercise ? (
          <ExerciseDetailContent
            exercise={mobileSelectedExercise}
            insight={exerciseInsightById[mobileInsightKey] || null}
            isLoading={loadingExerciseInsightById[mobileInsightKey] === true}
            error={exerciseInsightErrorById[mobileInsightKey] || ''}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

function useMinWidthMatch(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    function handleChange(event) {
      setMatches(event.matches);
    }

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-atlas-slate">{label}</div>
      <div className="mt-1 font-semibold text-atlas-ink">{value}</div>
    </div>
  );
}

function ExerciseInsightPanel({ exercise, insight, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-4 text-sm text-atlas-slate">
        Loading recent progress...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-4 text-sm text-atlas-slate">
        {error}
      </div>
    );
  }

  const progress = Array.isArray(insight?.progress) ? insight.progress : [];
  const historyByDate = groupHistoryByDate(Array.isArray(insight?.history) ? insight.history : []);

  if (progress.length === 0 && historyByDate.length === 0) {
    return (
      <div className="rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-4 text-sm text-atlas-slate">
        No prior progress for {formatExerciseName(exercise.exercise_name)} yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
          Recent progress
        </div>
        <div className="mt-3 space-y-2">
          {progress.length === 0 ? (
            <div className="text-sm text-atlas-slate">No previous sessions.</div>
          ) : (
            progress.map((entry) => (
              <div key={entry.session_id} className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-sm">
                <div className="font-semibold text-atlas-ink">
                  {formatLocalDate(entry.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="mt-2 text-atlas-slate">
                  {entry.set_count} sets - {Math.round(entry.total_volume)} volume
                </div>
                <div className="mt-1 text-atlas-slate">
                  Best set {entry.best_weight ?? '-'} kg x {entry.best_reps ?? '-'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
          Previous history
        </div>
        <div className="mt-3 space-y-2">
          {historyByDate.length === 0 ? (
            <div className="text-sm text-atlas-slate">No previous set history.</div>
          ) : (
            historyByDate.map((entry) => (
              <div key={entry.date} className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-sm">
                <div className="font-semibold text-atlas-ink">
                  {formatLocalDate(entry.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.sets.map((set) => (
                    <span key={`${entry.date}:${set.set_number}`} className="rounded-full border border-atlas-line px-3 py-1 text-xs text-atlas-ink">
                      S{set.set_number} {set.weight ?? '-'} kg x {set.reps ?? '-'}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseDetailContent({ exercise, insight, isLoading, error }) {
  return (
    <div className="space-y-3">
      <ExerciseInsightPanel
        exercise={exercise}
        insight={insight}
        isLoading={isLoading}
        error={error}
      />

      {exercise.sets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-panel px-4 py-4 text-sm text-atlas-slate">
          No sets logged.
        </div>
      ) : (
        exercise.sets.map((set) => (
          <div
            key={set.id}
            className="rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-3 text-sm"
          >
            {set.logged_exercise_name
              && Number(set.logged_exercise_id || 0) !== Number(exercise.effective_exercise_id || 0) ? (
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                Logged as {formatExerciseName(set.logged_exercise_name)}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Set" value={set.set_number} />
              <Metric label="Weight" value={formatMetric(set.weight)} />
              <Metric label="Reps" value={formatMetric(set.reps)} />
              <Metric label="RIR" value={formatMetric(set.rir)} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function groupHistoryByDate(rows) {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const currentRows = groupedRows.get(row.date) || [];
    currentRows.push(row);
    groupedRows.set(row.date, currentRows);
  });

  return Array.from(groupedRows.entries()).map(([date, sets]) => ({
    date,
    sets: [...sets].sort((left, right) => left.set_number - right.set_number),
  }));
}

function getExerciseInsightKey(exercise) {
  const exerciseId = Number(exercise?.effective_exercise_id || 0);

  if (!exerciseId) {
    return '';
  }

  return `${exerciseId}:all`;
}
