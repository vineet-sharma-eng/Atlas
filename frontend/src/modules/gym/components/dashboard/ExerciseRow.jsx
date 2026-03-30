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
    <article
      className={`rounded-[22px] border px-4 py-4 shadow-panel ${
        exercise.is_active
          ? 'border-atlas-line/80 bg-atlas-panel'
          : 'border-dashed border-atlas-line bg-atlas-mist/70'
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold capitalize text-atlas-ink">
                {exercise.exercise_name.replaceAll('_', ' ')}
              </h4>
              <span
                className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.14em] ${
                  exercise.is_active
                    ? 'bg-green-500/15 text-green-200'
                    : 'bg-zinc-700 text-zinc-200'
                }`}
              >
                {exercise.is_active ? 'Active' : 'Hidden'}
              </span>
            </div>
            <div className="mt-2 text-sm uppercase tracking-[0.14em] text-atlas-slate">
              {exercise.muscle_group || 'Accessory'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
              disabled={isPending}
              onClick={() => onMoveExercise(exercise.template_exercise_id, 'up')}
            >
              Up
            </button>
            <button
              type="button"
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
              disabled={isPending}
              onClick={() => onMoveExercise(exercise.template_exercise_id, 'down')}
            >
              Down
            </button>
            <button
              type="button"
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink disabled:opacity-50"
              disabled={isPending}
              onClick={() => onToggleExercise(exercise.template_exercise_id)}
            >
              {exercise.is_active ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <form className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_140px]" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Sets
            </span>
            <input
              className="w-full rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-sm text-atlas-ink"
              type="number"
              min="1"
              inputMode="numeric"
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
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Rep min
            </span>
            <input
              className="w-full rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-sm text-atlas-ink"
              type="number"
              min="1"
              inputMode="numeric"
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
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Rep max
            </span>
            <input
              className="w-full rounded-2xl border border-atlas-line bg-atlas-night px-3 py-3 text-sm text-atlas-ink"
              type="number"
              min="1"
              inputMode="numeric"
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
            className="rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60 sm:self-end"
            disabled={isSavingSet}
          >
            {isSavingSet ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </article>
  );
}
