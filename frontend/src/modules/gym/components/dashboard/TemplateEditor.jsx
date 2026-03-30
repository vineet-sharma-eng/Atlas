import { useEffect, useState } from 'react';
import { ExerciseRow } from './ExerciseRow';

export function TemplateEditor({
  template,
  isSavingTemplateName,
  isDuplicatingTemplate,
  pendingExerciseActionId,
  pendingTemplateSetId,
  onRenameTemplate,
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
      <section className="rounded-[24px] border border-dashed border-atlas-line bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
        Select a template to edit its name, exercise order, visibility, and target ranges.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <form className="flex-1" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                Template name
              </span>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  className="w-full rounded-2xl border border-atlas-line bg-white px-4 py-3 text-base"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-atlas-night px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  disabled={isSavingTemplateName}
                >
                  {isSavingTemplateName ? 'Saving...' : 'Save name'}
                </button>
              </div>
            </label>
          </form>

          <button
            type="button"
            className="rounded-2xl border border-atlas-line bg-white px-4 py-3 text-sm font-medium text-atlas-ink disabled:opacity-60"
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
        <div className="rounded-[24px] border border-dashed border-atlas-line bg-atlas-panel p-8 text-sm text-atlas-slate shadow-panel">
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
              onMoveExercise={onMoveExercise}
              onToggleExercise={onToggleExercise}
              onSaveSet={onSaveSet}
            />
          ))}
        </div>
      )}
    </section>
  );
}
