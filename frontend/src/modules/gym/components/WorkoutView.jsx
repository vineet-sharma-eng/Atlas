import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ExerciseAccordion } from './ExerciseAccordion';
import { formatExerciseName, formatLocalDate } from '../utils/formatters';

const INITIAL_EXERCISE_FORM = {
  exerciseName: '',
  muscleGroup: '',
};

export function WorkoutView({
  template,
  session,
  today,
  exercises,
  openExerciseId,
  availableMuscleGroups,
  suggestedExercises,
  sessionSummary,
  exerciseHistoryByKey,
  loadingExerciseHistoryByKey,
  exerciseHistoryErrorByKey,
  isLoading,
  isAddingExercise,
  isEndingSession,
  isSessionEditable,
  isWorkoutComplete,
  exerciseCatalog,
  isLoadingExerciseCatalog,
  onOpenExercise,
  onAddExercise,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onSaveSet,
  onEndSession,
  onAddExerciseToTemplate,
  onLoadExerciseHistory,
  onLoadAlternates,
  onSearchExerciseCatalog,
  onCreateAlternate,
  onSwapExercise,
}) {
  const [formValues, setFormValues] = useState(INITIAL_EXERCISE_FORM);
  const [showAddExerciseSheet, setShowAddExerciseSheet] = useState(false);
  const [showSessionActions, setShowSessionActions] = useState(false);
  const [showEndSessionReview, setShowEndSessionReview] = useState(false);
  const elapsedLabel = useSessionTimerLabel(session?.started_at, session?.ended_at);
  const progressLabel = `${sessionSummary.completed + sessionSummary.skipped}/${sessionSummary.total || 0}`;
  const unresolvedExercises = sessionSummary.unresolvedExercises;
  const suggestionButtons = useMemo(
    () => suggestedExercises.slice(0, 6),
    [suggestedExercises],
  );

  useEffect(() => {
    if (!isSessionEditable) {
      setShowAddExerciseSheet(false);
      setShowSessionActions(false);
      setShowEndSessionReview(false);
    }
  }, [isSessionEditable]);

  function handleOpenExercise(exerciseId) {
    onOpenExercise(exerciseId);
    setShowEndSessionReview(false);
  }

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
          setShowAddExerciseSheet(false);
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

  async function handleConfirmEndSession() {
    const didEndSession = await onEndSession();

    if (didEndSession) {
      setShowEndSessionReview(false);
      setShowSessionActions(false);
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
    <section className="space-y-3">
      <div className="sticky top-2 z-10 rounded-[20px] border border-atlas-line/80 bg-atlas-panel/95 px-3 shadow-panel backdrop-blur">
        <div className="flex h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              {template.day || formatWorkoutDay(today)}
            </div>
            <div className="truncate text-sm font-semibold text-atlas-ink">
              {template.name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-atlas-line bg-atlas-night px-2.5 py-1 text-xs font-semibold text-atlas-slate">
              {session ? elapsedLabel : 'Preview'}
            </div>
            <button
              type="button"
              aria-label="Session actions"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-atlas-line bg-atlas-mist text-atlas-ink"
              onClick={() => setShowSessionActions(true)}
            >
              ...
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <SummaryChip label="Progress" value={progressLabel} tone="default" />
        <SummaryChip label="Completed" value={String(sessionSummary.completed)} tone="completed" />
        <SummaryChip label="Skipped" value={String(sessionSummary.skipped)} tone="skipped" />
        <SummaryChip label="Pending" value={String(sessionSummary.pending)} tone="active" />
      </div>

      {!isSessionEditable && session ? (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          Workout completed. Logging is locked.
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
            const historyKey = getHistoryKey(exercise);

            return (
              <ExerciseAccordion
                key={exerciseId}
                exercise={exercise}
                recentHistory={exerciseHistoryByKey[historyKey] || []}
                isLoadingHistory={loadingExerciseHistoryByKey[historyKey] === true}
                historyError={exerciseHistoryErrorByKey[historyKey] || ''}
                isOpen={openExerciseId === exerciseId}
                isSessionEditable={isSessionEditable}
                isWorkoutComplete={isWorkoutComplete}
                exerciseCatalog={exerciseCatalog}
                isLoadingExerciseCatalog={isLoadingExerciseCatalog}
                onToggle={() => handleOpenExercise(exerciseId)}
                onSaveSet={onSaveSet}
                onRemoveExercise={onRemoveExercise}
                onUpdateExerciseStatus={onUpdateExerciseStatus}
                onAddExerciseToTemplate={onAddExerciseToTemplate}
                onLoadHistory={() => onLoadExerciseHistory(exercise)}
                onLoadAlternates={() => onLoadAlternates(exercise.template_exercise_id)}
                onSearchExerciseCatalog={onSearchExerciseCatalog}
                onCreateAlternate={onCreateAlternate}
                onSwapExercise={onSwapExercise}
              />
            );
          })}
        </div>
      )}

      {isSessionEditable ? (
        <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-3 py-3 shadow-panel">
          <button
            type="button"
            className="w-full rounded-2xl bg-atlas-accent px-4 py-3 text-base font-medium text-white disabled:opacity-60"
            disabled={!isSessionEditable}
            onClick={() => setShowAddExerciseSheet(true)}
          >
            Add exercise
          </button>
        </div>
      ) : null}

      <BottomSheet
        open={showSessionActions}
        title="Session actions"
        onClose={() => setShowSessionActions(false)}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4 text-sm text-atlas-slate">
            {session
              ? formatSessionTimingSummary(session)
              : `Previewing ${template.name}`}
          </div>

          {isSessionEditable ? (
            <button
              type="button"
              className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-left text-sm font-medium text-atlas-ink"
              onClick={() => {
                setShowSessionActions(false);
                setShowAddExerciseSheet(true);
              }}
            >
              Add exercise
            </button>
          ) : null}

          {session && isSessionEditable ? (
            <button
              type="button"
              className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm font-medium text-red-200"
              onClick={() => {
                setShowSessionActions(false);
                setShowEndSessionReview(true);
              }}
            >
              Finish session
            </button>
          ) : null}
        </div>
      </BottomSheet>

      <BottomSheet
        open={showAddExerciseSheet}
        title="Add exercise"
        onClose={() => setShowAddExerciseSheet(false)}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
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
                    className="rounded-full border border-atlas-line bg-atlas-night px-4 py-2 text-sm text-atlas-ink"
                    onClick={() => handleQuickAdd(exercise)}
                  >
                    {formatExerciseName(exercise.exercise_name)}
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
              className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
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
              className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
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
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink"
              onClick={() => setShowAddExerciseSheet(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={!isSessionEditable || isAddingExercise || formValues.exerciseName.trim() === ''}
            >
              {isAddingExercise ? 'Adding...' : 'Add exercise'}
            </button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet
        open={showEndSessionReview}
        title="Finish session"
        onClose={() => setShowEndSessionReview(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4 text-sm text-atlas-slate">
            Completed and skipped work will be saved as-is. Pending exercises stay unfinished if you end now.
          </div>

          {unresolvedExercises.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                Pending exercises
              </div>
              {unresolvedExercises.map((exercise) => {
                const exerciseId = exercise.session_exercise_id || exercise.template_exercise_id;

                return (
                  <button
                    key={exerciseId}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-left"
                    onClick={() => {
                      setShowEndSessionReview(false);
                      handleOpenExercise(exerciseId);
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium text-atlas-ink">
                        {formatExerciseName(exercise.exercise_name)}
                      </div>
                      <div className="mt-1 text-xs text-atlas-slate">
                        {exercise.target_sets} sets
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
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Everything in this session is resolved. You can end the workout now.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink"
              onClick={() => setShowEndSessionReview(false)}
            >
              Keep logging
            </button>
            <button
              type="button"
              className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={isEndingSession}
              onClick={() => {
                void handleConfirmEndSession();
              }}
            >
              {isEndingSession ? 'Ending...' : 'Confirm end'}
            </button>
          </div>
        </div>
      </BottomSheet>
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

function useSessionTimerLabel(startedAt, endedAt) {
  const [label, setLabel] = useState('Timer');

  useEffect(() => {
    if (!startedAt) {
      setLabel('Preview');
      return undefined;
    }

    function updateLabel() {
      setLabel(formatDuration(startedAt, endedAt));
    }

    updateLabel();
    if (endedAt) {
      return undefined;
    }

    const timerId = window.setInterval(updateLabel, 1000);
    return () => window.clearInterval(timerId);
  }, [endedAt, startedAt]);

  return label;
}

function getHistoryKey(exercise) {
  return `${exercise.effective_exercise_id || 'none'}:${exercise.session_exercise_id || exercise.template_exercise_id || 'preview'}`;
}

function formatWorkoutDay(today) {
  if (!today) {
    return 'Workout';
  }

  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${today}T00:00:00`));
}

function formatDuration(startedAt, endedAt) {
  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  const elapsedMs = Math.max(0, endMs - startMs);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSessionTimingSummary(session) {
  if (!session?.started_at) {
    return 'Session timing unavailable';
  }

  const startedAtLabel = new Date(session.started_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const durationLabel = formatDuration(session.started_at, session.ended_at);

  if (session.ended_at) {
    return `Started ${startedAtLabel} • Duration ${durationLabel}`;
  }

  return `Started ${startedAtLabel} • Running ${durationLabel}`;
}
