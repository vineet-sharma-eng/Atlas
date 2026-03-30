import { useEffect, useState } from 'react';
import { SetRow } from './SetRow';

function isTimeBasedExercise(notes) {
  return /sec/i.test(notes || '');
}

function buildRows(exercise) {
  const currentSetsByNumber = new Map(exercise.sets.map((set) => [set.set_number, set]));
  const prefillSetsByNumber = new Map(exercise.prefill_sets.map((set) => [set.set_number, set]));

  let previousWeight = '';

  return Array.from({ length: exercise.target_sets }, (_, index) => {
    const setNumber = index + 1;
    const currentSet = currentSetsByNumber.get(setNumber);
    const prefillSet = prefillSetsByNumber.get(setNumber);
    const nextWeight =
      currentSet?.weight ??
      prefillSet?.weight ??
      (previousWeight === '' ? '' : previousWeight);

    if (nextWeight !== '' && nextWeight !== null) {
      previousWeight = String(nextWeight);
    }

    return {
      setNumber,
      weight: nextWeight === null ? '' : String(nextWeight ?? ''),
      reps: currentSet?.reps ?? prefillSet?.reps ?? '',
      rir: currentSet?.rir ?? prefillSet?.rir ?? '',
      saved: Boolean(currentSet),
      saving: false,
      error: '',
    };
  });
}

function getTargetLabel(exercise) {
  if (exercise.rep_min === null && exercise.rep_max === null) {
    return `${exercise.target_sets} sets x AMRAP`;
  }

  return `${exercise.target_sets} sets x ${exercise.rep_min}-${exercise.rep_max}`;
}

export function ExerciseAccordion({
  exercise,
  isOpen,
  isSessionActive,
  isWorkoutComplete,
  onToggle,
  onSaveSet,
  onRemoveExercise,
  onSkipExercise,
  onAddExerciseToTemplate,
}) {
  const [rows, setRows] = useState(() => buildRows(exercise));
  const timeBased = isTimeBasedExercise(exercise.notes);

  useEffect(() => {
    setRows(buildRows(exercise));
  }, [exercise]);

  async function handleSaveRow(rowIndex) {
    const row = rows[rowIndex];

    if (!isSessionActive || row.saved || row.saving || !exercise.session_exercise_id) {
      return;
    }

    const weight = Number(row.weight);
    const reps = Number(row.reps);
    const rir = Number(row.rir);

    if (!Number.isFinite(weight) || weight < 0) {
      updateRow(rowIndex, { error: 'Weight must be a valid number.' });
      return;
    }

    if (!Number.isFinite(reps) || reps < 0) {
      updateRow(rowIndex, {
        error: timeBased ? 'Time must be a valid number.' : 'Reps must be a valid number.',
      });
      return;
    }

    if (!Number.isInteger(rir) || rir < 0 || rir > 4) {
      updateRow(rowIndex, { error: 'RIR must be an integer between 0 and 4.' });
      return;
    }

    updateRow(rowIndex, { saving: true, error: '' });

    try {
      await onSaveSet(exercise.session_exercise_id, {
        setNumber: row.setNumber,
        weight: row.weight,
        reps: row.reps,
        rir: row.rir,
      });

      setRows((currentRows) =>
        currentRows.map((currentRow, index) => {
          if (index === rowIndex) {
            return {
              ...currentRow,
              saved: true,
              saving: false,
              error: '',
            };
          }

          if (index === rowIndex + 1 && currentRow.weight === '') {
            return {
              ...currentRow,
              weight: row.weight,
            };
          }

          return currentRow;
        }),
      );
    } catch (error) {
      updateRow(rowIndex, {
        saving: false,
        error: error.message || 'Failed to save set',
      });
    }
  }

  function updateRow(rowIndex, patch) {
    setRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  }

  return (
    <article className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel shadow-panel">
      <button
        type="button"
        className="flex w-full flex-col gap-3 px-5 py-5 text-left sm:flex-row sm:items-center sm:justify-between"
        onClick={onToggle}
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
            {exercise.muscle_group || 'Accessory'}
          </div>
          <h3 className="mt-2 text-xl font-semibold capitalize text-atlas-ink">
            {exercise.exercise_name.replaceAll('_', ' ')}
          </h3>
          <p className="mt-1 text-sm text-atlas-slate">{getTargetLabel(exercise)}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {exercise.is_skipped ? (
            <span className="rounded-xl bg-atlas-mist px-3 py-2 text-atlas-ink">Skipped</span>
          ) : null}
          {exercise.can_add_to_template && isWorkoutComplete ? (
            <button
              type="button"
              className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-atlas-ink"
              onClick={(event) => {
                event.stopPropagation();
                onAddExerciseToTemplate(exercise);
              }}
            >
              Add to template
            </button>
          ) : null}
          {isSessionActive && exercise.session_exercise_id ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-atlas-line bg-white px-3 py-2 text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  onSkipExercise(exercise.session_exercise_id, !exercise.is_skipped);
                }}
              >
                {exercise.is_skipped ? 'Unskip' : 'Skip'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveExercise(exercise.session_exercise_id);
                }}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-atlas-line px-5 py-5">
          {exercise.notes ? <p className="mb-4 text-sm text-atlas-slate">{exercise.notes}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-atlas-slate">
                  <th className="px-4 py-2 font-medium">Set</th>
                  <th className="px-4 py-2 font-medium">Weight</th>
                  <th className="px-4 py-2 font-medium">{timeBased ? 'Time (sec)' : 'Reps'}</th>
                  <th className="px-4 py-2 font-medium">RIR</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <SetRow
                    key={row.setNumber}
                    row={row}
                    disabled={!isSessionActive || exercise.is_skipped}
                    onChange={(field, value) => updateRow(rowIndex, { [field]: value, error: '' })}
                    onSave={() => handleSaveRow(rowIndex)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </article>
  );
}
