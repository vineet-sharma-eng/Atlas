import { useEffect, useRef, useState } from 'react';
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
      savedValues: currentSet
        ? {
            weight: currentSet.weight === null ? '' : String(currentSet.weight ?? ''),
            reps: currentSet.reps ?? '',
            rir: currentSet.rir ?? '',
          }
        : null,
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
  recentHistory,
  isLoadingHistory,
  isOpen,
  isSessionEditable,
  isWorkoutComplete,
  onToggle,
  onSaveSet,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onAddExerciseToTemplate,
  onLoadHistory,
}) {
  const [rows, setRows] = useState(() => buildRows(exercise));
  const inputRefs = useRef(new Map());
  const timeBased = isTimeBasedExercise(exercise.notes);
  const isCompleted = exercise.status === 'completed';
  const isSkipped = exercise.status === 'skipped';
  const isActiveExercise = isOpen && isSessionEditable && !isCompleted && !isSkipped;

  useEffect(() => {
    setRows(buildRows(exercise));
  }, [exercise]);

  useEffect(() => {
    if (isOpen && !isLoadingHistory && recentHistory.length === 0) {
      void onLoadHistory();
    }
  }, [isLoadingHistory, isOpen, recentHistory.length, onLoadHistory]);

  useEffect(() => {
    if (!isOpen || !isSessionEditable || isSkipped || isCompleted) {
      return;
    }

    const nextIndex = rows.findIndex((row) => !isRowCommitted(row));
    if (nextIndex < 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      focusField(nextIndex, 'weight');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [exercise.session_exercise_id, isCompleted, isOpen, isSessionEditable, isSkipped]);

  function registerInput(rowIndex, field, node) {
    const key = `${rowIndex}:${field}`;

    if (node) {
      inputRefs.current.set(key, node);
    } else {
      inputRefs.current.delete(key);
    }
  }

  function focusField(rowIndex, field) {
    inputRefs.current.get(`${rowIndex}:${field}`)?.focus();
  }

  async function handleSaveRow(rowIndex) {
    const row = rows[rowIndex];

    if (!isSessionEditable || row.saving || !exercise.session_exercise_id) {
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
              savedValues: {
                weight: row.weight,
                reps: row.reps,
                rir: row.rir,
              },
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

      const nextRowIndex = rowIndex + 1;
      if (nextRowIndex < rows.length) {
        window.setTimeout(() => {
          focusField(nextRowIndex, 'weight');
        }, 0);
      }
    } catch (error) {
      updateRow(rowIndex, {
        saving: false,
        error: error.message || 'Failed to save set',
      });
    }
  }

  function handleAdvance(rowIndex, field) {
    if (field === 'weight') {
      focusField(rowIndex, 'reps');
      return;
    }

    if (field === 'reps') {
      focusField(rowIndex, 'rir');
      return;
    }

    if (!isRowComplete(rows[rowIndex])) {
      if (rows[rowIndex].weight === '') {
        focusField(rowIndex, 'weight');
        return;
      }

      if (rows[rowIndex].reps === '') {
        focusField(rowIndex, 'reps');
        return;
      }

      if (rows[rowIndex].rir === '') {
        focusField(rowIndex, 'rir');
        return;
      }
    }

    void handleSaveRow(rowIndex);
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
    <article
      className={`rounded-[24px] border shadow-panel ${
        isActiveExercise
          ? 'border-atlas-accent bg-atlas-panel'
          : isCompleted
            ? 'border-green-500/30 bg-atlas-panel'
            : isSkipped
              ? 'border-atlas-line/60 bg-atlas-mist/60'
              : 'border-atlas-line/80 bg-atlas-panel'
      }`}
    >
      <button
        type="button"
        className="flex w-full flex-col gap-3 px-4 py-4 text-left"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              {exercise.muscle_group || 'Accessory'}
            </div>
            <h3 className="mt-2 truncate text-xl font-semibold capitalize text-atlas-ink">
              {exercise.exercise_name.replaceAll('_', ' ')}
            </h3>
            <p className="mt-2 text-sm text-atlas-slate">{getTargetLabel(exercise)}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {isActiveExercise ? (
              <span className="rounded-full bg-atlas-accentSoft px-3 py-1 text-xs font-semibold text-blue-200">
                Active
              </span>
            ) : null}
            {isCompleted ? (
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-200">
                Completed
              </span>
            ) : null}
            {isSkipped ? (
              <span className="rounded-full bg-atlas-skipped px-3 py-1 text-xs font-semibold text-zinc-200">
                Skipped
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-atlas-line/80 px-4 py-4">
          {exercise.notes ? (
            <p className="mb-4 rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3 text-sm text-atlas-slate">
              {exercise.notes}
            </p>
          ) : null}

          <div className="mb-4 rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Recent history
            </div>
            {isLoadingHistory ? (
              <p className="mt-2 text-sm text-atlas-slate">Loading recent sets...</p>
            ) : recentHistory.length > 0 ? (
              <div className="mt-3 space-y-2">
                {recentHistory.map((entry, entryIndex) => (
                  <div
                    key={`${entry.date}:${entryIndex}`}
                    className="rounded-2xl border border-atlas-line/80 bg-atlas-night px-3 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                      {formatHistoryDate(entry.date)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.sets.map((set) => (
                        <span
                          key={`${entry.date}:${entryIndex}:${set.set_number}`}
                          className="rounded-full border border-atlas-line px-3 py-1 text-xs text-atlas-ink"
                        >
                          S{set.set_number} {formatSetSummary(set, timeBased)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-atlas-slate">
                No previous session data for this exercise yet.
              </p>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {exercise.can_add_to_template && isWorkoutComplete ? (
              <button
                type="button"
                className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  void onAddExerciseToTemplate(exercise);
                }}
              >
                Add to template
              </button>
            ) : null}
            {isSessionEditable && exercise.session_exercise_id && !isSkipped ? (
              <button
                type="button"
                className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  void onUpdateExerciseStatus(exercise.session_exercise_id, 'skipped');
                }}
              >
                Skip exercise
              </button>
            ) : null}
            {isSessionEditable && exercise.session_exercise_id ? (
              <button
                type="button"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                onClick={(event) => {
                  event.stopPropagation();
                  void onRemoveExercise(exercise.session_exercise_id);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            {rows.map((row, rowIndex) => {
              const canEditRow =
                isSessionEditable &&
                !isSkipped &&
                rows.slice(0, rowIndex).every(isRowCommitted);
              const saveDisabled =
                !canEditRow || row.saving || !isRowComplete(row) || isRowCommitted(row);

              return (
                <SetRow
                  key={row.setNumber}
                  row={row}
                  disabled={!canEditRow}
                  saveDisabled={saveDisabled}
                  isCommitted={isRowCommitted(row)}
                  timeBased={timeBased}
                  previousWeight={rowIndex > 0 ? rows[rowIndex - 1].weight : ''}
                  registerInput={(field, node) => registerInput(rowIndex, field, node)}
                  onChange={(field, value) => updateRow(rowIndex, { [field]: value, error: '' })}
                  onAdvance={(field) => handleAdvance(rowIndex, field)}
                  onApplyWeightDelta={(delta) => {
                    const currentWeight = Number(row.weight || 0);
                    const nextWeight = Number.isFinite(currentWeight)
                      ? String((currentWeight + delta).toFixed(1).replace(/\.0$/, ''))
                      : String(delta);

                    updateRow(rowIndex, { weight: nextWeight, error: '' });
                  }}
                  onCopyPreviousWeight={() =>
                    updateRow(rowIndex, {
                      weight: rows[rowIndex - 1]?.weight || '',
                      error: '',
                    })
                  }
                  onSave={() => handleSaveRow(rowIndex)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function isRowComplete(row) {
  return row.weight !== '' && row.reps !== '' && row.rir !== '';
}

function isRowCommitted(row) {
  if (!row.saved || !row.savedValues) {
    return false;
  }

  return (
    String(row.savedValues.weight) === String(row.weight) &&
    String(row.savedValues.reps) === String(row.reps) &&
    String(row.savedValues.rir) === String(row.rir)
  );
}

function formatHistoryDate(dateValue) {
  return new Date(dateValue).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatSetSummary(set, timeBased) {
  const repsLabel = timeBased ? `${set.reps ?? '-'} sec` : `${set.reps ?? '-'} reps`;
  const weightLabel = `${set.weight ?? '-'} kg`;
  const rirLabel = `RIR ${set.rir ?? '-'}`;

  return `${weightLabel} - ${repsLabel} - ${rirLabel}`;
}
