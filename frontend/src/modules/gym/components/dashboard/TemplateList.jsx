export function TemplateList({
  templates,
  selectedTemplateId,
  isLoading,
  onSelectTemplate,
}) {
  return (
    <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel shadow-panel">
      <div className="border-b border-atlas-line/70 px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
          Templates
        </div>
        <h2 className="mt-2 text-lg font-semibold text-atlas-ink">Workout templates</h2>
      </div>

      <div className="max-h-[720px] overflow-y-auto p-3">
        {isLoading ? (
          <div className="rounded-2xl border border-atlas-line bg-white px-4 py-5 text-sm text-atlas-slate">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-atlas-line bg-white px-4 py-5 text-sm text-atlas-slate">
            No templates available.
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const isSelected = String(template.id) === String(selectedTemplateId);
              const hiddenCount = template.exercises.filter((exercise) => !exercise.is_active).length;
              const exercisePreview = template.exercises
                .slice(0, 4)
                .map((exercise) => exercise.exercise_name.replaceAll('_', ' '))
                .join(', ');

              return (
                <button
                  key={template.id}
                  type="button"
                  className={`w-full rounded-2xl border px-4 py-4 text-left ${
                    isSelected
                      ? 'border-atlas-night bg-atlas-night text-white'
                      : 'border-atlas-line bg-white text-atlas-ink'
                  }`}
                  onClick={() => onSelectTemplate(String(template.id))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`text-xs uppercase tracking-[0.16em] ${isSelected ? 'text-white/70' : 'text-atlas-slate'}`}>
                        {template.day || 'Unscheduled'}
                      </div>
                      <div className="mt-2 text-base font-semibold">{template.name}</div>
                    </div>
                    {hiddenCount > 0 ? (
                      <span className={`rounded-full px-2 py-1 text-xs ${isSelected ? 'bg-white/15 text-white' : 'bg-atlas-mist text-atlas-slate'}`}>
                        {hiddenCount} hidden
                      </span>
                    ) : null}
                  </div>

                  <div className={`mt-3 text-sm ${isSelected ? 'text-white/80' : 'text-atlas-slate'}`}>
                    {template.exercises.length} exercises
                  </div>
                  <div className={`mt-2 text-sm ${isSelected ? 'text-white/85' : 'text-atlas-ink'}`}>
                    {exercisePreview}
                    {template.exercises.length > 4 ? '...' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
