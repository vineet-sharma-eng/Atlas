import { formatExerciseName } from '../../utils/formatters';

export function TemplateList({
  templates,
  selectedTemplateId,
  isLoading,
  onSelectTemplate,
}) {
  return (
    <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-3 shadow-panel">
      <div className="px-2 pb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          Templates
        </div>
        <h2 className="mt-2 text-lg font-semibold text-atlas-ink">Workout templates</h2>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-5 text-sm text-atlas-slate">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atlas-line bg-atlas-mist px-4 py-5 text-sm text-atlas-slate">
          No templates available.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const isSelected = String(template.id) === String(selectedTemplateId);
            const hiddenCount = template.exercises.filter((exercise) => !exercise.is_active).length;
            const exercisePreview = template.exercises
              .slice(0, 4)
              .map((exercise) => formatExerciseName(exercise.exercise_name))
              .join(', ');

            return (
              <button
                key={template.id}
                type="button"
                className={`w-full rounded-2xl border px-4 py-4 text-left ${
                  isSelected
                    ? 'border-atlas-accent bg-atlas-accentSoft text-white'
                    : 'border-atlas-line bg-atlas-mist text-atlas-ink'
                }`}
                onClick={() => onSelectTemplate(String(template.id))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-xs uppercase tracking-[0.16em] ${isSelected ? 'text-blue-100' : 'text-atlas-slate'}`}>
                      {template.day || 'Unscheduled'}
                    </div>
                    <div className="mt-2 text-base font-semibold">{template.name}</div>
                  </div>
                  {hiddenCount > 0 ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs ${isSelected ? 'bg-white/10 text-white' : 'bg-atlas-panel text-atlas-slate'}`}>
                      {hiddenCount} hidden
                    </span>
                  ) : null}
                </div>

                <div className={`mt-3 text-sm ${isSelected ? 'text-blue-100' : 'text-atlas-slate'}`}>
                  {template.exercises.length} exercises
                </div>
                <div className={`mt-2 text-sm ${isSelected ? 'text-white' : 'text-atlas-ink'}`}>
                  {exercisePreview}
                  {template.exercises.length > 4 ? '...' : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
