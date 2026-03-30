import { useState } from 'react';
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
      }
    }).catch(() => {});
  }

  if (isLoading) {
    return (
      <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
        Loading template and history...
      </section>
    );
  }

  if (!template) {
    return (
      <section className="rounded-[24px] border border-dashed border-atlas-line bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
        Select a workout template to load template structure and history-based prefills.
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel px-5 py-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              Session workspace
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-atlas-ink">{template.name}</h2>
            <p className="mt-1 text-sm leading-6 text-atlas-slate">
              {session
                ? isSessionEditable
                  ? 'Log the active session. History values are suggestions only.'
                  : 'Workout completed. Session edits are locked.'
                : 'Review the planned workout, then start the session to begin logging.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session ? (
              <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-atlas-slate">Status</div>
                <div className="mt-2 text-xl font-semibold capitalize text-atlas-ink">{session.status}</div>
              </div>
            ) : null}

            {session && isSessionEditable ? (
              <button
                type="button"
                className="rounded-2xl bg-atlas-night px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-atlas-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isEndingSession}
                onClick={() => {
                  void onEndSession();
                }}
              >
                {isEndingSession ? 'Ending...' : 'End Workout'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {!isSessionEditable && session ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Workout Completed
        </div>
      ) : null}

      <form
        className="grid gap-3 rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel md:grid-cols-[minmax(0,1fr)_220px_180px]"
        onSubmit={handleSubmit}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-atlas-ink">Add exercise</span>
          <input
            className="w-full rounded-2xl border border-atlas-line bg-white px-4 py-3 text-base shadow-sm disabled:bg-atlas-mist"
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
          <span className="mb-2 block text-sm font-medium text-atlas-ink">Muscle group</span>
          <select
            className="w-full rounded-2xl border border-atlas-line bg-white px-4 py-3 text-base shadow-sm disabled:bg-atlas-mist"
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

        <button
          type="submit"
          className="rounded-2xl bg-atlas-night px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-atlas-ink disabled:cursor-not-allowed disabled:opacity-60 md:self-end"
          disabled={!isSessionEditable || isAddingExercise}
        >
          {isAddingExercise ? 'Adding...' : 'Add Exercise'}
        </button>
      </form>

      {exercises.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-atlas-line bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
          No exercises available for this session.
        </div>
      ) : (
        exercises.map((exercise) => (
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
        ))
      )}
    </section>
  );
}
