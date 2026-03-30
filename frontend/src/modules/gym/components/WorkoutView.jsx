import { useEffect, useState } from 'react';
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
}) {
  const [formValues, setFormValues] = useState(INITIAL_EXERCISE_FORM);
  const [showAddExerciseForm, setShowAddExerciseForm] = useState(false);

  useEffect(() => {
    if (!isSessionEditable) {
      setShowAddExerciseForm(false);
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
    }).then((didAddExercise) => {
      if (didAddExercise) {
        setFormValues(INITIAL_EXERCISE_FORM);
        setShowAddExerciseForm(false);
      }
    }).catch(() => {});
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
      <div className="sticky top-[69px] z-10 rounded-[22px] border border-atlas-line/80 bg-atlas-panel/95 px-4 py-4 shadow-panel backdrop-blur">
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
                  ? `${exercises.length} exercises. Only one movement stays open at a time.`
                  : 'Workout completed. Logging is locked.'
                : 'Load the structure, then start the session to begin logging.'}
            </p>
          </div>

          {session && isSessionEditable ? (
            <button
              type="button"
              className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={isEndingSession}
              onClick={() => {
                void onEndSession();
              }}
            >
              {isEndingSession ? 'Ending...' : 'End'}
            </button>
          ) : null}
        </div>
      </div>

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
          {exercises.map((exercise) => (
            <ExerciseAccordion
              key={exercise.session_exercise_id || exercise.template_exercise_id}
              exercise={exercise}
              isOpen={
                openExerciseId ===
                (exercise.session_exercise_id || exercise.template_exercise_id)
              }
              isSessionEditable={isSessionEditable}
              isWorkoutComplete={isWorkoutComplete}
              onToggle={() =>
                onOpenExercise(exercise.session_exercise_id || exercise.template_exercise_id)
              }
              onSaveSet={onSaveSet}
              onRemoveExercise={onRemoveExercise}
              onUpdateExerciseStatus={onUpdateExerciseStatus}
              onAddExerciseToTemplate={onAddExerciseToTemplate}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-3 z-10 space-y-3">
        {showAddExerciseForm && isSessionEditable ? (
          <form
            className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-3">
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
                  onClick={() => setShowAddExerciseForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  disabled={!isSessionEditable || isAddingExercise}
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
            className="w-full rounded-2xl bg-atlas-accent px-4 py-3 text-base font-medium text-white disabled:opacity-60"
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
