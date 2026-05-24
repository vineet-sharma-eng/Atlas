import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ExerciseAccordion } from './ExerciseAccordion';
import { formatExerciseName, formatLocalDate } from '../utils/formatters';

const INITIAL_EXERCISE_FORM = {
  exerciseId: '',
  exerciseName: '',
  muscleGroup: '',
  targetSets: '3',
  repMin: '8',
  repMax: '12',
  targetRir: '2',
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
  exerciseNotesById,
  loadingExerciseNotesById,
  exerciseNotesErrorById,
  onOpenExercise,
  onAddExercise,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onSaveSet,
  onUpdateSessionTargets,
  onSaveTargetsToTemplate,
  onSaveExerciseDefaults,
  onEndSession,
  onAddExerciseToTemplate,
  onLoadExerciseHistory,
  onLoadExerciseNotes,
  onCreateExerciseNote,
  onUpdateExerciseNote,
  onDeleteExerciseNote,
  onLoadAlternates,
  onSearchExerciseCatalog,
  onCreateAlternate,
  onUpdateAlternate,
  onDeleteAlternate,
  onSwapExercise,
}) {
  const [formValues, setFormValues] = useState(INITIAL_EXERCISE_FORM);
  const [showAddExerciseSheet, setShowAddExerciseSheet] = useState(false);
  const [showSessionActions, setShowSessionActions] = useState(false);
  const [showEndSessionReview, setShowEndSessionReview] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
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

    onAddExercise(buildAddExercisePayload(formValues, { addToTemplate: false }))
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
      exerciseId: exercise.exercise_id,
      exerciseName: exercise.exercise_name,
      muscleGroup: exercise.muscle_group || '',
      targetSets: exercise.default_target_sets || 3,
      repMin: exercise.default_rep_min ?? 8,
      repMax: exercise.default_rep_max ?? 12,
      targetRir: exercise.default_target_rir ?? 2,
    }).catch(() => {});
  }

  function handlePickCatalogExercise(exercise) {
    setFormValues((currentValues) => ({
      ...currentValues,
      exerciseId: String(exercise.id),
      exerciseName: exercise.name,
      muscleGroup: exercise.muscle_group || currentValues.muscleGroup,
      targetSets: String(exercise.default_target_sets || currentValues.targetSets || 3),
      repMin: exercise.default_rep_min === null ? currentValues.repMin : String(exercise.default_rep_min),
      repMax: exercise.default_rep_max === null ? currentValues.repMax : String(exercise.default_rep_max),
      targetRir: exercise.default_target_rir === null ? currentValues.targetRir : String(exercise.default_target_rir),
    }));
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
      <div className="sticky top-2 z-10 md:top-3">
        <div className="overflow-hidden rounded-[24px] border border-atlas-line/50 bg-atlas-panel/72 px-3 py-2.5 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-atlas-line/60 bg-atlas-night/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                  {template.day || formatWorkoutDay(today)}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-atlas-slate">
                  {session ? `${progressLabel} resolved` : 'Preview mode'}
                </span>
              </div>
              <div className="mt-2 truncate text-base font-semibold text-atlas-ink md:text-lg">
                {template.name}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-full border border-atlas-line/60 bg-atlas-night/78 px-3 py-1.5 text-sm font-semibold tabular-nums text-atlas-ink">
                {session ? elapsedLabel : 'Preview'}
              </div>
              <button
                type="button"
                aria-label="Session actions"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-atlas-line/60 bg-atlas-mist/70 text-atlas-ink transition-colors hover:border-atlas-accent/40 hover:bg-atlas-accentSoft/40 md:h-10 md:w-10"
                onClick={() => setShowSessionActions(true)}
              >
                <ActionDots />
              </button>
            </div>
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
                exerciseNotes={exerciseNotesById[exercise.effective_exercise_id] || []}
                isLoadingExerciseNotes={loadingExerciseNotesById[exercise.effective_exercise_id] === true}
                exerciseNotesError={exerciseNotesErrorById[exercise.effective_exercise_id] || ''}
                onToggle={() => handleOpenExercise(exerciseId)}
                onSaveSet={onSaveSet}
                onUpdateSessionTargets={onUpdateSessionTargets}
                onSaveTargetsToTemplate={onSaveTargetsToTemplate}
                onSaveExerciseDefaults={onSaveExerciseDefaults}
                onRemoveExercise={onRemoveExercise}
                onUpdateExerciseStatus={onUpdateExerciseStatus}
                onAddExerciseToTemplate={onAddExerciseToTemplate}
                onLoadHistory={() => onLoadExerciseHistory(exercise)}
                onLoadExerciseNotes={() => onLoadExerciseNotes(exercise)}
                onCreateExerciseNote={(body) => onCreateExerciseNote(exercise, body)}
                onUpdateExerciseNote={(noteId, payload) => onUpdateExerciseNote(exercise, noteId, payload)}
                onDeleteExerciseNote={(noteId) => onDeleteExerciseNote(exercise, noteId)}
                onLoadAlternates={() => onLoadAlternates(exercise.template_exercise_id)}
                onSearchExerciseCatalog={onSearchExerciseCatalog}
                onCreateAlternate={onCreateAlternate}
                onUpdateAlternate={onUpdateAlternate}
                onDeleteAlternate={onDeleteAlternate}
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

          <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Exercise catalog
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-3 text-base text-atlas-ink"
              type="text"
              placeholder="Search existing exercises"
              value={catalogSearch}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCatalogSearch(nextValue);
                void onSearchExerciseCatalog(nextValue);
              }}
            />
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {exerciseCatalog.slice(0, 8).map((catalogExercise) => (
                <button
                  key={catalogExercise.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${
                    String(formValues.exerciseId) === String(catalogExercise.id)
                      ? 'border-atlas-accent bg-atlas-accentSoft/40'
                      : 'border-atlas-line bg-atlas-panel'
                  }`}
                  onClick={() => handlePickCatalogExercise(catalogExercise)}
                >
                  <div>
                    <div className="text-sm font-medium text-atlas-ink">
                      {formatExerciseName(catalogExercise.name)}
                    </div>
                    <div className="mt-1 text-xs text-atlas-slate">
                      {catalogExercise.muscle_group || 'Exercise'}
                    </div>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                    Pick
                  </span>
                </button>
              ))}
              {isLoadingExerciseCatalog ? (
                <div className="px-1 py-2 text-sm text-atlas-slate">Loading exercises...</div>
              ) : null}
            </div>
          </div>

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
                  exerciseId: '',
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <NumericConfigField
              label="Sets"
              value={formValues.targetSets}
              min="1"
              onChange={(value) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  targetSets: value,
                }))
              }
            />
            <NumericConfigField
              label="Rep min"
              value={formValues.repMin}
              min="1"
              onChange={(value) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  repMin: value,
                }))
              }
            />
            <NumericConfigField
              label="Rep max"
              value={formValues.repMax}
              min="1"
              onChange={(value) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  repMax: value,
                }))
              }
            />
            <NumericConfigField
              label="Target RIR"
              value={formValues.targetRir}
              min="0"
              max="4"
              onChange={(value) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  targetRir: value,
                }))
              }
            />
          </div>

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
              {isAddingExercise ? 'Adding...' : 'Add today'}
            </button>
          </div>
          <button
            type="button"
            className="w-full rounded-2xl border border-atlas-accent/40 bg-atlas-accentSoft/40 px-4 py-3 text-sm font-medium text-blue-100 disabled:opacity-60"
            disabled={!isSessionEditable || isAddingExercise || formValues.exerciseName.trim() === ''}
            onClick={() => {
              onAddExercise(buildAddExercisePayload(formValues, { addToTemplate: true }))
                .then((didAddExercise) => {
                  if (didAddExercise) {
                    setFormValues(INITIAL_EXERCISE_FORM);
                    setShowAddExerciseSheet(false);
                  }
                })
                .catch(() => {});
            }}
          >
            Add today and future sessions
          </button>
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

function NumericConfigField({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
        {label}
      </span>
      <input
        className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3 text-sm text-atlas-ink"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildAddExercisePayload(formValues, { addToTemplate }) {
  return {
    exerciseId: formValues.exerciseId ? Number(formValues.exerciseId) : null,
    exerciseName: formValues.exerciseName.trim(),
    muscleGroup: formValues.muscleGroup.trim(),
    targetSets: Number(formValues.targetSets || 1),
    repMin: formValues.repMin === '' ? null : Number(formValues.repMin),
    repMax: formValues.repMax === '' ? null : Number(formValues.repMax),
    targetRir: formValues.targetRir === '' ? null : Number(formValues.targetRir),
    addToTemplate,
  };
}

function ActionDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
    </span>
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
