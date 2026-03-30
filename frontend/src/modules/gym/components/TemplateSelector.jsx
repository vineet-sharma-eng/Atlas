function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  template,
  session,
  today,
  isLoadingTemplates,
  isLoadingSessionInit,
  isStartingSession,
  onChangeTemplate,
  onStartSession,
}) {
  const isSessionActive = session?.status === 'active';

  return (
    <section className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel p-5 shadow-panel">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              Template selection
            </div>
            <h2 className="mt-2 text-xl font-semibold text-atlas-ink">Choose workout</h2>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-atlas-ink">Template</span>
            <select
              className="w-full rounded-2xl border border-atlas-line bg-white px-4 py-3 text-base shadow-sm"
              value={selectedTemplateId}
              onChange={(event) => onChangeTemplate(event.target.value)}
              disabled={isLoadingTemplates || templates.length === 0 || isSessionActive}
            >
              {templates.length === 0 ? (
                <option value="">No templates found</option>
              ) : (
                templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </label>

          {template ? (
            <div className="rounded-2xl border border-atlas-line bg-white px-4 py-4 text-sm shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-atlas-ink">{template.name}</div>
                  <div className="mt-1 text-atlas-slate">
                    {template.day || 'No assigned day'}
                    {template.day_order ? ` • Order ${template.day_order}` : ''}
                  </div>
                </div>
                <div className="rounded-xl bg-atlas-mist px-3 py-2 text-atlas-ink">
                  {session ? `${session.status} • ${formatDate(session.date)}` : `Today ${formatDate(today)}`}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="rounded-2xl bg-atlas-night px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-atlas-ink disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!template || isLoadingSessionInit || isStartingSession || isSessionActive}
          onClick={onStartSession}
        >
          {isSessionActive ? 'Active Session Loaded' : isStartingSession ? 'Starting...' : 'Start Session'}
        </button>
      </div>
    </section>
  );
}
