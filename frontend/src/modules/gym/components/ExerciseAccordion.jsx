import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { SetRow } from './SetRow';
import { formatExerciseName, formatLocalDate } from '../utils/formatters';

function isTimeBasedExercise(notes) {
  return /sec/i.test(notes || '');
}

function buildRows(exercise) {
  const currentSetsByNumber = new Map(exercise.sets.map((set) => [set.set_number, set]));
  const prefillSets = Array.isArray(exercise.prefill_sets) ? exercise.prefill_sets : [];
  const prefillSetsByNumber = new Map(prefillSets.map((set) => [set.set_number, set]));

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
      rir: currentSet?.rir ?? prefillSet?.rir ?? exercise.target_rir ?? '',
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
  const rirLabel = exercise.target_rir === null || exercise.target_rir === undefined
    ? ''
    : ` @ RIR ${exercise.target_rir}`;

  if (exercise.rep_min === null && exercise.rep_max === null) {
    return `${exercise.target_sets} sets x AMRAP${rirLabel}`;
  }

  return `${exercise.target_sets} sets x ${exercise.rep_min}-${exercise.rep_max}${rirLabel}`;
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
  exerciseNotes,
  isLoadingExerciseNotes,
  exerciseNotesError,
  onToggle,
  onSaveSet,
  onUpdateSessionTargets,
  onSaveTargetsToTemplate,
  onSaveExerciseDefaults,
  onRemoveExercise,
  onUpdateExerciseStatus,
  onAddExerciseToTemplate,
  onLoadHistory,
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
  const [rows, setRows] = useState(() => buildRows(exercise));
  const [showAlternates, setShowAlternates] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [alternateName, setAlternateName] = useState('');
  const [alternateMuscleGroup, setAlternateMuscleGroup] = useState('');
  const [alternateTargetValues, setAlternateTargetValues] = useState(() => buildTargetFormValues(exercise));
  const [alternateError, setAlternateError] = useState('');
  const [isSavingAlternate, setIsSavingAlternate] = useState(false);
  const [targetValues, setTargetValues] = useState(() => buildTargetFormValues(exercise));
  const [targetError, setTargetError] = useState('');
  const [targetAction, setTargetAction] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteById, setEditingNoteById] = useState({});
  const [noteActionId, setNoteActionId] = useState(null);
  const [pendingSwapId, setPendingSwapId] = useState(null);
  const inputRefs = useRef(new Map());
  const timeBased = isTimeBasedExercise(exercise.notes);
  const isCompleted = exercise.status === 'completed';
  const isSkipped = exercise.status === 'skipped';
  const isActiveExercise = isOpen && isSessionEditable && !isCompleted && !isSkipped;

  useEffect(() => {
    setRows(buildRows(exercise));
    setTargetValues(buildTargetFormValues(exercise));
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
    if (showNotes) {
      void onLoadExerciseNotes();
    }
  }, [onLoadExerciseNotes, showNotes]);

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

  async function handleTargetAction(action) {
    if (!exercise.session_exercise_id) {
      return;
    }

    const normalizedTargets = normalizeTargetValues(targetValues);

    if (normalizedTargets.error) {
      setTargetError(normalizedTargets.error);
      return;
    }

    setTargetError('');
    setTargetAction(action);

    try {
      if (action === 'today') {
        await onUpdateSessionTargets(exercise.session_exercise_id, normalizedTargets.targets);
      } else if (action === 'template') {
        await onUpdateSessionTargets(exercise.session_exercise_id, normalizedTargets.targets);
        await onSaveTargetsToTemplate(exercise, normalizedTargets.targets);
      } else if (action === 'defaults') {
        await onSaveExerciseDefaults(exercise, normalizedTargets.targets);
      }
    } catch (error) {
      setTargetError(error.message || 'Failed to save targets');
    } finally {
      setTargetAction('');
    }
  }

  function handleAddSetToday() {
    const nextTargetSets = String(Number(targetValues.targetSets || exercise.target_sets || 1) + 1);
    const nextValues = {
      ...targetValues,
      targetSets: nextTargetSets,
    };
    setTargetValues(nextValues);

    if (exercise.session_exercise_id) {
      void onUpdateSessionTargets(exercise.session_exercise_id, normalizeTargetValues(nextValues).targets)
        .catch((error) => setTargetError(error.message || 'Failed to add set'));
    }
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
        ...toAlternatePayload(alternateTargetValues),
      });
      setAlternateName('');
      setAlternateMuscleGroup('');
      setAlternateTargetValues(buildTargetFormValues(exercise));
    } catch (error) {
      setAlternateError(error.message || 'Failed to add alternate');
    } finally {
      setIsSavingAlternate(false);
    }
  }

  async function handleUpdateAlternateTargets(alternate) {
    const normalizedTargets = normalizeTargetValues(targetValues);

    if (normalizedTargets.error) {
      setAlternateError(normalizedTargets.error);
      return;
    }

    try {
      await onUpdateAlternate(alternate.id, normalizedTargets.targets);
    } catch (error) {
      setAlternateError(error.message || 'Failed to update alternate');
    }
  }

  async function handleCreateNote(event) {
    event.preventDefault();
    const body = noteDraft.trim();

    if (!body) {
      return;
    }

    setNoteActionId('new');
    try {
      await onCreateExerciseNote(body);
      setNoteDraft('');
    } finally {
      setNoteActionId(null);
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

          {exercise.pinned_note?.body ? (
            <button
              type="button"
              className="mb-4 w-full rounded-2xl border border-atlas-accent/40 bg-atlas-accentSoft/30 px-3 py-3 text-left text-sm text-blue-100"
              onClick={() => setShowNotes(true)}
            >
              {exercise.pinned_note.body}
            </button>
          ) : null}

          {exercise.same_day_usage ? (
            <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
              Earlier today: {formatExerciseName(exercise.same_day_usage.exercise_name)}
              {exercise.same_day_usage.set_count > 0
                ? ` (${exercise.same_day_usage.set_count} sets)`
                : ''}
              {exercise.same_day_usage.used_alternate ? ' as an alternate' : ''}
            </div>
          ) : null}

          {isSessionEditable && exercise.session_exercise_id ? (
            <div className="mb-4 rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
                  Targets
                </div>
                <button
                  type="button"
                  className="rounded-full border border-atlas-line bg-atlas-night px-3 py-1.5 text-xs text-atlas-ink"
                  onClick={handleAddSetToday}
                >
                  + Set today
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <TargetInput
                  label="Sets"
                  value={targetValues.targetSets}
                  min="1"
                  onChange={(value) => setTargetValues((current) => ({ ...current, targetSets: value }))}
                />
                <TargetInput
                  label="Rep min"
                  value={targetValues.repMin}
                  min="1"
                  onChange={(value) => setTargetValues((current) => ({ ...current, repMin: value }))}
                />
                <TargetInput
                  label="Rep max"
                  value={targetValues.repMax}
                  min="1"
                  onChange={(value) => setTargetValues((current) => ({ ...current, repMax: value }))}
                />
                <TargetInput
                  label="Target RIR"
                  value={targetValues.targetRir}
                  min="0"
                  max="4"
                  onChange={(value) => setTargetValues((current) => ({ ...current, targetRir: value }))}
                />
              </div>
              {targetError ? (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
                  {targetError}
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-2xl bg-atlas-accent px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  disabled={targetAction !== ''}
                  onClick={() => {
                    void handleTargetAction('today');
                  }}
                >
                  {targetAction === 'today' ? 'Saving...' : 'Today only'}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-2.5 text-sm font-medium text-atlas-ink disabled:opacity-60"
                  disabled={targetAction !== ''}
                  onClick={() => {
                    void handleTargetAction('template');
                  }}
                >
                  {targetAction === 'template' ? 'Saving...' : 'Save future'}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-atlas-line bg-atlas-night px-3 py-2.5 text-sm font-medium text-atlas-ink disabled:opacity-60"
                  disabled={targetAction !== ''}
                  onClick={() => {
                    void handleTargetAction('defaults');
                  }}
                >
                  {targetAction === 'defaults' ? 'Saving...' : 'Exercise default'}
                </button>
              </div>
            </div>
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
            <button
              type="button"
              className="rounded-2xl border border-atlas-line bg-atlas-mist px-3 py-2 text-sm text-atlas-ink"
              onClick={(event) => {
                event.stopPropagation();
                setShowNotes(true);
              }}
            >
              Notes
            </button>
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
        open={showNotes}
        title="Exercise notes"
        onClose={() => setShowNotes(false)}
      >
        <div className="space-y-4">
          <form className="space-y-3 rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4" onSubmit={handleCreateNote}>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-atlas-line bg-atlas-panel px-4 py-3 text-sm text-atlas-ink"
              placeholder="Add form cue, setup note, or reminder"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={noteActionId === 'new' || noteDraft.trim() === ''}
            >
              {noteActionId === 'new' ? 'Saving...' : 'Add pinned note'}
            </button>
          </form>

          {isLoadingExerciseNotes ? (
            <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4 text-sm text-atlas-slate">
              Loading notes...
            </div>
          ) : exerciseNotesError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {exerciseNotesError}
            </div>
          ) : exerciseNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-mist px-4 py-4 text-sm text-atlas-slate">
              No exercise notes yet.
            </div>
          ) : (
            <div className="space-y-3">
              {exerciseNotes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-atlas-line bg-atlas-night px-4 py-4">
                  <textarea
                    className="min-h-20 w-full rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-3 text-sm text-atlas-ink"
                    value={editingNoteById[note.id] ?? note.body}
                    onChange={(event) =>
                      setEditingNoteById((current) => ({
                        ...current,
                        [note.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-2xl bg-atlas-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      disabled={noteActionId === note.id}
                      onClick={() => {
                        setNoteActionId(note.id);
                        onUpdateExerciseNote(note.id, {
                          body: editingNoteById[note.id] ?? note.body,
                        }).finally(() => setNoteActionId(null));
                      }}
                    >
                      Save
                    </button>
                    {!note.is_pinned ? (
                      <button
                        type="button"
                        className="rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-2 text-sm text-atlas-ink"
                        disabled={noteActionId === note.id}
                        onClick={() => {
                          setNoteActionId(note.id);
                          onUpdateExerciseNote(note.id, { is_pinned: true })
                            .finally(() => setNoteActionId(null));
                        }}
                      >
                        Pin
                      </button>
                    ) : (
                      <span className="rounded-2xl border border-atlas-accent/40 bg-atlas-accentSoft/40 px-3 py-2 text-sm text-blue-100">
                        Pinned
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                      disabled={noteActionId === note.id}
                      onClick={() => {
                        const confirmed = window.confirm('Delete this exercise note?');
                        if (confirmed) {
                          setNoteActionId(note.id);
                          onDeleteExerciseNote(note.id).finally(() => setNoteActionId(null));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={showAlternates}
        title="Choose alternate"
        onClose={() => setShowAlternates(false)}
      >
        <div className="space-y-4">
          {exercise.alternates.length > 0 ? (
            <div className="space-y-2">
              {exercise.alternates.map((alternate) => (
                <article
                  key={alternate.id}
                  className="rounded-2xl border border-atlas-line bg-atlas-night px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-atlas-ink">
                        {formatExerciseName(alternate.exercise_name)}
                      </div>
                      <div className="mt-1 text-xs text-atlas-slate">
                        {alternate.muscle_group || 'Alternate'}
                      </div>
                      <div className="mt-2 text-xs text-blue-100">
                        {formatAlternateTarget(alternate, exercise)}
                      </div>
                    </div>
                    {pendingSwapId === alternate.id ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                        Saving
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className="rounded-2xl bg-atlas-accent px-3 py-2 text-sm font-medium text-white"
                      onClick={() => {
                        void handleSelectAlternate(alternate.id).catch(() => {});
                      }}
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-2 text-sm text-atlas-ink"
                      onClick={() => {
                        void handleUpdateAlternateTargets(alternate);
                      }}
                    >
                      Match current
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                      onClick={() => {
                        const confirmed = window.confirm(`Remove ${formatExerciseName(alternate.exercise_name)} as an alternate?`);
                        if (confirmed) {
                          void onDeleteAlternate(alternate.id, exercise.template_exercise_id).catch(() => {});
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
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
                      ...toAlternatePayload(alternateTargetValues),
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
            <div className="grid grid-cols-2 gap-2">
              <TargetInput
                label="Sets"
                value={alternateTargetValues.targetSets}
                min="1"
                onChange={(value) => setAlternateTargetValues((current) => ({ ...current, targetSets: value }))}
              />
              <TargetInput
                label="Rep min"
                value={alternateTargetValues.repMin}
                min="1"
                onChange={(value) => setAlternateTargetValues((current) => ({ ...current, repMin: value }))}
              />
              <TargetInput
                label="Rep max"
                value={alternateTargetValues.repMax}
                min="1"
                onChange={(value) => setAlternateTargetValues((current) => ({ ...current, repMax: value }))}
              />
              <TargetInput
                label="Target RIR"
                value={alternateTargetValues.targetRir}
                min="0"
                max="4"
                onChange={(value) => setAlternateTargetValues((current) => ({ ...current, targetRir: value }))}
              />
            </div>
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

function TargetInput({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-atlas-slate">
        {label}
      </span>
      <input
        className="w-full rounded-2xl border border-atlas-line bg-atlas-panel px-3 py-3 text-sm text-atlas-ink"
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

function buildTargetFormValues(exercise) {
  return {
    targetSets: String(exercise.target_sets ?? 1),
    repMin: exercise.rep_min === null || exercise.rep_min === undefined ? '' : String(exercise.rep_min),
    repMax: exercise.rep_max === null || exercise.rep_max === undefined ? '' : String(exercise.rep_max),
    targetRir: exercise.target_rir === null || exercise.target_rir === undefined ? '' : String(exercise.target_rir),
  };
}

function normalizeTargetValues(values) {
  const targetSets = Number(values.targetSets);
  const repMin = values.repMin === '' ? null : Number(values.repMin);
  const repMax = values.repMax === '' ? null : Number(values.repMax);
  const targetRir = values.targetRir === '' ? null : Number(values.targetRir);

  if (!Number.isInteger(targetSets) || targetSets <= 0) {
    return { error: 'Sets must be a positive whole number.' };
  }

  if ((repMin === null) !== (repMax === null)) {
    return { error: 'Rep min and rep max must both be set or both be blank.' };
  }

  if (repMin !== null && (!Number.isInteger(repMin) || !Number.isInteger(repMax) || repMin <= 0 || repMax <= 0)) {
    return { error: 'Rep range must use positive whole numbers.' };
  }

  if (repMin !== null && repMin > repMax) {
    return { error: 'Rep min cannot be greater than rep max.' };
  }

  if (targetRir !== null && (!Number.isInteger(targetRir) || targetRir < 0 || targetRir > 4)) {
    return { error: 'Target RIR must be between 0 and 4.' };
  }

  return {
    targets: {
      targetSets,
      repMin,
      repMax,
      targetRir,
    },
  };
}

function toAlternatePayload(values) {
  const normalizedTargets = normalizeTargetValues(values);

  if (normalizedTargets.error) {
    return {};
  }

  return {
    target_sets: normalizedTargets.targets.targetSets,
    rep_min: normalizedTargets.targets.repMin,
    rep_max: normalizedTargets.targets.repMax,
    target_rir: normalizedTargets.targets.targetRir,
  };
}

function formatAlternateTarget(alternate, baseExercise) {
  const targetSets = alternate.target_sets ?? baseExercise.target_sets;
  const repMin = alternate.rep_min ?? baseExercise.rep_min;
  const repMax = alternate.rep_max ?? baseExercise.rep_max;
  const targetRir = alternate.target_rir ?? baseExercise.target_rir;
  const rirLabel = targetRir === null || targetRir === undefined ? '' : ` @ RIR ${targetRir}`;

  if (repMin === null || repMin === undefined || repMax === null || repMax === undefined) {
    return `${targetSets || 1} sets x AMRAP${rirLabel}`;
  }

  return `${targetSets || 1} sets x ${repMin}-${repMax}${rirLabel}`;
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
