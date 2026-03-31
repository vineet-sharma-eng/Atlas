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
  const isCompletedToday = session?.status === 'completed' && session?.date === today;
  const sessionLabel = session
    ? `${session.status} - ${formatDate(session.date)}`
    : `Today - ${formatDate(today)}`;
  const buttonLabel = isSessionActive
    ? 'Active session loaded'
    : isStartingSession
      ? 'Starting...'
      : isCompletedToday
        ? 'Start another session'
        : 'Start session';

  return (
    <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-4 shadow-panel">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-end">
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
              Start from template
            </div>
            <h2 className="mt-2 text-lg font-semibold text-atlas-ink">Choose workout</h2>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-atlas-ink">Template</span>
            <select
              className="w-full rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-3 text-base text-atlas-ink"
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
            <div className="rounded-2xl border border-atlas-line bg-atlas-mist px-4 py-4 text-sm">
              <div className="font-semibold text-atlas-ink">{template.name}</div>
              <div className="mt-1 text-atlas-slate">
                {template.day || 'No assigned day'}
                {template.day_order ? ` - Order ${template.day_order}` : ''}
              </div>
              <div className="mt-3 inline-flex rounded-xl border border-atlas-line bg-atlas-panel px-3 py-2 text-atlas-ink">
                {sessionLabel}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="rounded-2xl bg-atlas-accent px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!template || isLoadingSessionInit || isStartingSession || isSessionActive}
          onClick={onStartSession}
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
