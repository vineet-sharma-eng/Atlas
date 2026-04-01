import { useEffect, useState } from 'react';
import { ExerciseRow } from './ExerciseRow';

export function TemplateEditor({
  template,
  isSavingTemplateName,
  isDuplicatingTemplate,
  pendingExerciseActionId,
  pendingTemplateSetId,
  pendingRenameExerciseId,
  onRenameTemplate,
  onRenameExercise,
  onDuplicateTemplate,
  onMoveExercise,
  onToggleExercise,
  onSaveSet,
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(template?.name || '');
  }, [template]);

  function handleSubmit(event) {
    event.preventDefault();
    void onRenameTemplate(name);
  }

  if (!template) {
    return (
      <section className="rounded-[22px] border border-dashed border-atlas-line bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
        Select a template to edit its name, targets, order, and visibility.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel">
        <div className="flex flex-col gap-3">
          <form className="flex-1" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                Template name
              </span>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                <input
                  className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  disabled={isSavingTemplateName}
                >
                  {isSavingTemplateName ? 'Saving...' : 'Save name'}
                </button>
              </div>
            </label>
          </form>

          <button
            type="button"
            className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink disabled:opacity-60"
            disabled={isDuplicatingTemplate}
            onClick={() => {
              void onDuplicateTemplate();
            }}
          >
            {isDuplicatingTemplate ? 'Duplicating...' : 'Duplicate template'}
          </button>
        </div>
      </div>

      {template.exercises.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-atlas-line bg-atlas-panel p-6 text-sm text-atlas-slate shadow-panel">
          This template does not have any exercises yet.
        </div>
      ) : (
        <div className="space-y-3">
          {template.exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.template_exercise_id}
              exercise={exercise}
              isPending={pendingExerciseActionId === exercise.template_exercise_id}
              isSavingSet={pendingTemplateSetId === exercise.template_set_id}
              isRenaming={pendingRenameExerciseId === exercise.exercise_id}
              onMoveExercise={onMoveExercise}
              onToggleExercise={onToggleExercise}
              onRenameExercise={onRenameExercise}
              onSaveSet={onSaveSet}
            />
          ))}
        </div>
      )}
    </section>
  );
}
