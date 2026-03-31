import { useEffect, useMemo, useState } from 'react';
import { ExerciseAccordion } from './ExerciseAccordion';

const INITIAL_EXERCISE_FORM = {
  exerciseName: '',
  muscleGroup: '',
};

export function WorkoutView({
  template,
  session,
  exercises,
  openExerciseId,
  availableMuscleGroups,
  suggestedExercises,
  sessionSummary,
  exerciseHistoryByName,
  loadingExerciseHistoryByName,
  isLoading,
  isAddingExercise,
  isEndingSession,
  isSessionEditable,
  isWorkoutComplete,
  onOpenExercise,
  onAddExercise,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onSaveSet,
  onEndSession,
  onAddExerciseToTemplate,
  onLoadExerciseHistory,
}) {
  const [formValues, setFormValues] = useState(INITIAL_EXERCISE_FORM);
  const [showAddExerciseForm, setShowAddExerciseForm] = useState(false);
  const [showEndSessionReview, setShowEndSessionReview] = useState(false);
  const progressLabel = `${sessionSummary.completed + sessionSummary.skipped}/${sessionSummary.total || 0}`;
  const unresolvedExercises = sessionSummary.unresolvedExercises;

  const suggestionButtons = useMemo(
    () => suggestedExercises.slice(0, 6),
    [suggestedExercises],
  );

  useEffect(() => {
    if (!isSessionEditable) {
      setShowAddExerciseForm(false);
      setShowEndSessionReview(false);
    }
  }, [isSessionEditable]);

  function handleSubmit(event) {
    event.preventDefault();

    const exerciseName = formValues.exerciseName.trim();
    if (!isSessionEditable || !exerciseName || isAddingExercise) {
      return;
    }

    onAddExercise({
      exerciseName,
      muscleGroup: formValues.muscleGroup.trim(),
    })
      .then((didAddExercise) => {
        if (didAddExercise) {
          setFormValues(INITIAL_EXERCISE_FORM);
          setShowAddExerciseForm(false);
        }
      })
      .catch(() => {});
  }

  function handleQuickAdd(exercise) {
    if (!isSessionEditable || isAddingExercise) {
      return;
    }

    onAddExercise({
      exerciseName: exercise.exercise_name,
      muscleGroup: exercise.muscle_group || '',
    }).catch(() => {});
  }

  function handleOpenExercise(exerciseId) {
    onOpenExercise(exerciseId);
    setShowEndSessionReview(false);
  }

  async function handleConfirmEndSession() {
    try {
      const didEndSession = await onEndSession();
      if (!didEndSession) {
        return;
      }

      setShowEndSessionReview(false);
    } catch (_) {
      // Error surface already lives in the shared page state.
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
        Loading template and history...
      </section>
    );
  }

  if (!template) {
    return (
      <section className="rounded-[22px] border border-dashed border-atlas-line bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
        Select a workout template to load target sets and history-based defaults.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-[69px] z-10 space-y-3 rounded-[22px] border border-atlas-line/80 bg-atlas-panel/95 px-4 py-4 shadow-panel backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              {session ? `Session - ${session.status}` : 'Template preview'}
            </div>
            <h2 className="mt-2 truncate text-xl font-semibold text-atlas-ink">
              {template.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-atlas-slate">
              {session
                ? isSessionEditable
                  ? `${sessionSummary.pending} pending. One movement stays open so logging stays fast.`
                  : 'Workout completed. Logging is locked.'
                : 'Load the structure, then start the session to begin logging.'}
            </p>
          </div>

          {session && isSessionEditable ? (
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={isEndingSession}
              onClick={() => setShowEndSessionReview((currentValue) => !currentValue)}
            >
              {showEndSessionReview ? 'Close review' : 'End workout'}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="Progress" value={progressLabel} tone="default" />
          <SummaryChip label="Completed" value={String(sessionSummary.completed)} tone="completed" />
          <SummaryChip label="Skipped" value={String(sessionSummary.skipped)} tone="skipped" />
          <SummaryChip label="Pending" value={String(sessionSummary.pending)} tone="active" />
        </div>
      </div>

      {showEndSessionReview && session && isSessionEditable ? (
        <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                Finish workout
              </div>
              <h3 className="mt-2 text-lg font-semibold text-atlas-ink">Review before lock</h3>
              <p className="mt-2 text-sm leading-6 text-atlas-slate">
                Completed and skipped work will be saved as-is. Pending exercises stay unfinished if you end now.
              </p>
            </div>
            <div className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-2 text-sm text-atlas-ink">
              {sessionSummary.percentComplete}% done
            </div>
          </div>

          {unresolvedExercises.length > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                Pending exercises
              </div>
              {unresolvedExercises.map((exercise) => {
                const exerciseId = exercise.session_exercise_id || exercise.template_exercise_id;

                return (
                  <button
                    key={exerciseId}
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-left"
                    onClick={() => handleOpenExercise(exerciseId)}
                  >
                    <div>
                      <div className="text-sm font-medium capitalize text-atlas-ink">
                        {exercise.exercise_name.replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 text-xs text-atlas-slate">
                        {exercise.target_sets} sets
                        {exercise.rep_min !== null && exercise.rep_max !== null
                          ? ` x ${exercise.rep_min}-${exercise.rep_max}`
                          : ' x AMRAP'}
                      </div>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
                      Open
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Everything in this session is resolved. You can end the workout now.
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="min-h-11 rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink"
              onClick={() => setShowEndSessionReview(false)}
            >
              Keep logging
            </button>
            <button
              type="button"
              className="min-h-11 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={isEndingSession}
              onClick={() => {
                void handleConfirmEndSession();
              }}
            >
              {isEndingSession ? 'Ending...' : 'Confirm end'}
            </button>
          </div>
        </section>
      ) : null}

      {!isSessionEditable && session ? (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Workout Completed
        </div>
      ) : null}

      {exercises.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-atlas-line bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
          No exercises are available for this session yet.
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => {
            const exerciseId = exercise.session_exercise_id || exercise.template_exercise_id;
            const historyKey = normalizeExerciseName(exercise.exercise_name);

            return (
              <ExerciseAccordion
                key={exerciseId}
                exercise={exercise}
                recentHistory={exerciseHistoryByName[historyKey] || []}
                isLoadingHistory={loadingExerciseHistoryByName[historyKey] === true}
                isOpen={openExerciseId === exerciseId}
                isSessionEditable={isSessionEditable}
                isWorkoutComplete={isWorkoutComplete}
                onToggle={() => handleOpenExercise(exerciseId)}
                onSaveSet={onSaveSet}
                onRemoveExercise={onRemoveExercise}
                onUpdateExerciseStatus={onUpdateExerciseStatus}
                onAddExerciseToTemplate={onAddExerciseToTemplate}
                onLoadHistory={() => onLoadExerciseHistory(exercise.exercise_name)}
              />
            );
          })}
        </div>
      )}

      <div className="sticky bottom-3 z-10 space-y-3">
        {showAddExerciseForm && isSessionEditable ? (
          <form
            className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel"
            onSubmit={handleSubmit}
          >
            <div className="space-y-3">
              {suggestionButtons.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                    Quick add
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestionButtons.map((exercise) => (
                      <button
                        key={`${exercise.source}:${exercise.exercise_name}`}
                        type="button"
                        className="min-h-11 rounded-full border border-atlas-line bg-atlas-night px-4 py-2 text-sm text-atlas-ink"
                        onClick={() => handleQuickAdd(exercise)}
                      >
                        {exercise.exercise_name.replaceAll('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                  Exercise
                </span>
                <input
                  className="min-h-11 w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
                  type="text"
                  placeholder="Cable fly"
                  value={formValues.exerciseName}
                  disabled={!isSessionEditable}
                  onChange={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      exerciseName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                  Muscle group
                </span>
                <select
                  className="min-h-11 w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
                  value={formValues.muscleGroup}
                  disabled={!isSessionEditable}
                  onChange={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      muscleGroup: event.target.value,
                    }))
                  }
                >
                  <option value="">Select</option>
                  {availableMuscleGroups.map((muscleGroup) => (
                    <option key={muscleGroup} value={muscleGroup}>
                      {muscleGroup}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="min-h-11 rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink"
                  onClick={() => setShowAddExerciseForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  disabled={!isSessionEditable || isAddingExercise || formValues.exerciseName.trim() === ''}
                >
                  {isAddingExercise ? 'Adding...' : 'Add exercise'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-3 py-3 shadow-panel">
          <button
            type="button"
            className="min-h-11 w-full rounded-2xl bg-atlas-accent px-4 py-3 text-base font-medium text-white disabled:opacity-60"
            disabled={!isSessionEditable}
            onClick={() => setShowAddExerciseForm((current) => !current)}
          >
            {showAddExerciseForm ? 'Close add exercise' : 'Add exercise'}
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryChip({ label, value, tone }) {
  const toneClassName =
    tone === 'completed'
      ? 'border-green-500/30 bg-green-500/10 text-green-200'
      : tone === 'skipped'
        ? 'border-atlas-line bg-atlas-night text-atlas-slate'
        : tone === 'active'
          ? 'border-atlas-accent/40 bg-atlas-accentSoft/40 text-blue-100'
          : 'border-atlas-line bg-atlas-night text-atlas-ink';

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClassName}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function normalizeExerciseName(value) {
  return String(value || '').trim().toLowerCase();
}
