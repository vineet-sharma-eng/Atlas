import { useEffect, useState } from 'react';

const INITIAL_FORM_STATE = {
  targetSets: '',
  repMin: '',
  repMax: '',
};

export function ExerciseRow({
  exercise,
  isPending,
  isSavingSet,
  onMoveExercise,
  onToggleExercise,
  onSaveSet,
}) {
  const [formValues, setFormValues] = useState(INITIAL_FORM_STATE);

  useEffect(() => {
    setFormValues({
      targetSets: String(exercise.target_sets ?? ''),
      repMin: exercise.rep_min === null ? '' : String(exercise.rep_min),
      repMax: exercise.rep_max === null ? '' : String(exercise.rep_max),
    });
  }, [exercise]);

  function handleSubmit(event) {
    event.preventDefault();

    onSaveSet(exercise.template_set_id, {
      target_sets: Number(formValues.targetSets),
      rep_min: formValues.repMin === '' ? null : Number(formValues.repMin),
      rep_max: formValues.repMax === '' ? null : Number(formValues.repMax),
    });
  }

  return (
    <article className={`rounded-2xl border px-4 py-4 ${exercise.is_active ? 'border-atlas-line bg-white' : 'border-dashed border-atlas-line bg-atlas-mist/70'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold capitalize text-atlas-ink">
              {exercise.exercise_name.replaceAll('_', ' ')}
            </h4>
            <span className={`rounded-full px-2 py-1 text-xs uppercase tracking-[0.14em] ${exercise.is_active ? 'bg-green-50 text-green-700' : 'bg-atlas-night/10 text-atlas-slate'}`}>
              {exercise.is_active ? 'Active' : 'Hidden'}
            </span>
          </div>
          <div className="mt-2 text-sm uppercase tracking-[0.14em] text-atlas-slate">
            {exercise.muscle_group || 'Accessory'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
            disabled={isPending}
            onClick={() => onMoveExercise(exercise.template_exercise_id, 'up')}
          >
            Move up
          </button>
          <button
            type="button"
            className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
            disabled={isPending}
            onClick={() => onMoveExercise(exercise.template_exercise_id, 'down')}
          >
            Move down
          </button>
          <button
            type="button"
            className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
            disabled={isPending}
            onClick={() => onToggleExercise(exercise.template_exercise_id)}
          >
            {exercise.is_active ? 'Hide' : 'Unhide'}
          </button>
        </div>
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-[120px_120px_120px_140px]" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">Sets</span>
          <input
            className="w-full rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm"
            type="number"
            min="1"
            value={formValues.targetSets}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                targetSets: event.target.value,
              }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">Rep min</span>
          <input
            className="w-full rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm"
            type="number"
            min="1"
            value={formValues.repMin}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                repMin: event.target.value,
              }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">Rep max</span>
          <input
            className="w-full rounded-xl border border-atlas-line bg-white px-3 py-2 text-sm"
            type="number"
            min="1"
            value={formValues.repMax}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                repMax: event.target.value,
              }))
            }
          />
        </label>

        <button
          type="submit"
          className="rounded-xl bg-atlas-night px-4 py-2 text-sm font-medium text-white disabled:opacity-60 md:self-end"
          disabled={isSavingSet}
        >
          {isSavingSet ? 'Saving...' : 'Save targets'}
        </button>
      </form>
    </article>
  );
}
