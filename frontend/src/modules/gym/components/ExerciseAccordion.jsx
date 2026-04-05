import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { SetRow } from './SetRow';
import { formatExerciseName, formatLocalDate } from '../utils/formatters';

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
  historyError,
  isOpen,
  isSessionEditable,
  isWorkoutComplete,
  exerciseCatalog,
  isLoadingExerciseCatalog,
  onToggle,
  onSaveSet,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onAddExerciseToTemplate,
  onLoadHistory,
  onLoadAlternates,
  onSearchExerciseCatalog,
  onCreateAlternate,
  onSwapExercise,
}) {
  const [rows, setRows] = useState(() => buildRows(exercise));
  const [showAlternates, setShowAlternates] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [alternateName, setAlternateName] = useState('');
  const [alternateMuscleGroup, setAlternateMuscleGroup] = useState('');
  const [alternateError, setAlternateError] = useState('');
  const [isSavingAlternate, setIsSavingAlternate] = useState(false);
  const [pendingSwapId, setPendingSwapId] = useState(null);
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
    if (!showAlternates) {
      return;
    }

    void onLoadAlternates();

    if (exerciseCatalog.length === 0) {
      void onSearchExerciseCatalog('');
    }
  }, [showAlternates, onLoadAlternates, onSearchExerciseCatalog, exerciseCatalog.length]);

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

  async function handleSelectAlternate(alternateId) {
    if (!exercise.session_exercise_id) {
      return;
    }

    setPendingSwapId(alternateId);
    const result = await onSwapExercise(exercise.session_exercise_id, alternateId);

    if (result?.type === 'confirmation_required') {
      const confirmed = window.confirm(result.message);

      if (confirmed) {
        await onSwapExercise(exercise.session_exercise_id, alternateId, true);
        setShowAlternates(false);
      }
    } else if (result?.type === 'updated') {
      setShowAlternates(false);
    }

    setPendingSwapId(null);
  }

  async function handleUndoSwap() {
    if (!exercise.session_exercise_id) {
      return;
    }

    setPendingSwapId(0);
    const result = await onSwapExercise(exercise.session_exercise_id, null);

    if (result?.type === 'confirmation_required') {
      const confirmed = window.confirm(result.message);

      if (confirmed) {
        await onSwapExercise(exercise.session_exercise_id, null, true);
      }
    }

    setPendingSwapId(null);
  }

  async function handleCreateAlternate(event) {
    event.preventDefault();

    const normalizedName = alternateName.trim();
    if (!normalizedName) {
      setAlternateError('Alternate name is required.');
      return;
    }

    const duplicate = exercise.alternates.some(
      (alternate) => normalizeExerciseName(alternate.exercise_name) === normalizeExerciseName(normalizedName),
    );

    if (duplicate) {
      setAlternateError('This alternate already exists for this slot.');
      return;
    }

    setIsSavingAlternate(true);
    setAlternateError('');

    try {
      await onCreateAlternate(exercise.template_exercise_id, {
        name: normalizedName,
        muscle_group: alternateMuscleGroup.trim(),
      });
      setAlternateName('');
      setAlternateMuscleGroup('');
    } catch (error) {
      setAlternateError(error.message || 'Failed to add alternate');
    } finally {
      setIsSavingAlternate(false);
    }
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-semibold text-atlas-ink">
                {formatExerciseName(exercise.exercise_name)}
              </h3>
              {exercise.is_overridden ? (
                <span className="rounded-full border border-atlas-accent/40 bg-atlas-accentSoft/40 px-2.5 py-1 text-[11px] font-semibold text-blue-100">
                  Alt
                </span>
              ) : null}
            </div>
            {exercise.is_overridden ? (
              <p className="mt-2 text-sm text-blue-100">
                Planned: {formatExerciseName(exercise.original_exercise_name)}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-atlas-slate">{getTargetLabel(exercise)}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {exercise.can_swap && isSessionEditable ? (
              <button
                type="button"
                aria-label="Choose alternate"
                className="rounded-full border border-atlas-line bg-atlas-mist px-3 py-1.5 text-xs font-semibold text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowAlternates(true);
                }}
              >
                Alt
              </button>
            ) : null}
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
            ) : historyError ? (
              <p className="mt-2 text-sm text-atlas-slate">{historyError}</p>
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
                No previous data
              </p>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {exercise.is_overridden && isSessionEditable ? (
              <button
                type="button"
                className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleUndoSwap();
                }}
              >
                Undo alternate
              </button>
            ) : null}
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
            {isSessionEditable && exercise.session_exercise_id ? (
              <button
                type="button"
                className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
                onClick={(event) => {
                  event.stopPropagation();
                  void onUpdateExerciseStatus(
                    exercise.session_exercise_id,
                    isSkipped ? 'pending' : 'skipped',
                  );
                }}
              >
                {isSkipped ? 'Unskip exercise' : 'Skip exercise'}
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
              const loggedSet = exercise.sets.find((set) => set.set_number === row.setNumber);
              const canEditRow =
                isSessionEditable &&
                !isSkipped &&
                rows.slice(0, rowIndex).every(isRowCommitted);
              const saveDisabled =
                !canEditRow || row.saving || !isRowComplete(row) || isRowCommitted(row);
              const showLoggedExerciseLabel =
                loggedSet?.logged_exercise_name
                && Number(loggedSet.logged_exercise_id || 0) !== Number(exercise.effective_exercise_id || 0);

              return (
                <div key={row.setNumber} className="space-y-2">
                  {showLoggedExerciseLabel ? (
                    <div className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                      Logged as {formatExerciseName(loggedSet.logged_exercise_name)}
                    </div>
                  ) : null}
                  <SetRow
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
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={showAlternates}
        title="Choose alternate"
        onClose={() => setShowAlternates(false)}
      >
        <div className="space-y-4">
          {exercise.alternates.length > 0 ? (
            <div className="space-y-2">
              {exercise.alternates.map((alternate) => (
                <button
                  key={alternate.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-atlas-line bg-atlas-night px-4 py-3 text-left"
                  onClick={() => {
                    void handleSelectAlternate(alternate.id).catch(() => {});
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-atlas-ink">
                      {formatExerciseName(alternate.exercise_name)}
                    </div>
                    <div className="mt-1 text-xs text-atlas-slate">
                      {alternate.muscle_group || 'Alternate'}
                    </div>
                  </div>
                  {pendingSwapId === alternate.id ? (
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                      Saving
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-mist px-4 py-4 text-sm text-atlas-slate">
              No alternates yet. Add one below.
            </div>
          )}

          <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Add alternate from existing exercises
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-3 text-sm text-atlas-ink"
              type="text"
              placeholder="Search exercises"
              value={catalogSearch}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCatalogSearch(nextValue);
                void onSearchExerciseCatalog(nextValue);
              }}
            />
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {exerciseCatalog
                .filter((catalogExercise) => Number(catalogExercise.id) !== Number(exercise.exercise_id))
                .map((catalogExercise) => (
                <button
                  key={catalogExercise.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-3 text-left"
                  onClick={() => {
                    void onCreateAlternate(exercise.template_exercise_id, {
                      exercise_id: catalogExercise.id,
                    }).catch(() => {});
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-atlas-ink">{catalogExercise.name}</div>
                    <div className="mt-1 text-xs text-atlas-slate">{catalogExercise.muscle_group || 'Exercise'}</div>
                  </div>
                  {isLoadingExerciseCatalog ? (
                    <span className="text-xs text-atlas-slate">Loading</span>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                      Add
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-3 rounded-2xl border border-atlas-line bg-atlas-night px-4 py-4" onSubmit={handleCreateAlternate}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-slate">
              Add new alternate
            </div>
            <input
              className="w-full rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-3 text-sm text-atlas-ink"
              type="text"
              placeholder="Light barbell squat"
              value={alternateName}
              onChange={(event) => {
                setAlternateName(event.target.value);
                setAlternateError('');
              }}
            />
            <input
              className="w-full rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-3 text-sm text-atlas-ink"
              type="text"
              placeholder="Legs"
              value={alternateMuscleGroup}
              onChange={(event) => setAlternateMuscleGroup(event.target.value)}
            />
            {alternateError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
                {alternateError}
              </div>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={isSavingAlternate}
            >
              {isSavingAlternate ? 'Saving...' : 'Save alternate'}
            </button>
          </form>
        </div>
      </BottomSheet>
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
  return formatLocalDate(dateValue, {
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

function normalizeExerciseName(value) {
  return String(value || '').trim().toLowerCase();
}
