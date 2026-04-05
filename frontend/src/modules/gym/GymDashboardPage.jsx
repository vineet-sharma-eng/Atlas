import { useEffect, useMemo, useState } from 'react';
import { useAtlasDashboard } from '../../hooks/useAtlasDashboard';
import { useGymDashboard } from '../../hooks/useGymDashboard';
import { SessionDetail } from './components/dashboard/SessionDetail';
import { SessionList } from './components/dashboard/SessionList';
import { TemplateEditor } from './components/dashboard/TemplateEditor';
import { TemplateList } from './components/dashboard/TemplateList';

const DASHBOARD_PANELS = [
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
];

export function GymDashboardPage() {
  const dashboard = useGymDashboard();
  const atlasDashboard = useAtlasDashboard();
  const routeState = useDashboardHashState();
  const [activePanel, setActivePanel] = useState(routeState.panel);

  useEffect(() => {
    setActivePanel(routeState.panel);
  }, [routeState.panel]);

  useEffect(() => {
    if (activePanel !== 'history') {
      return;
    }

    dashboard.setSelectedSessionId(routeState.sessionId || '');
  }, [activePanel, routeState.sessionId]);

  const isHistoryDrawerOpen = activePanel === 'history' && Boolean(dashboard.selectedSessionId);
  const dashboardTitle = useMemo(
    () => (activePanel === 'templates' ? 'Template editor' : 'History'),
    [activePanel],
  );

  function handleSelectPanel(panelId) {
    setHashState({ panel: panelId, sessionId: '' });
  }

  function handleSelectSession(sessionId) {
    setHashState({ panel: 'history', sessionId });
  }

  function handleCloseSession() {
    setHashState({ panel: 'history', sessionId: '' });
  }

  return (
    <main className="min-h-screen px-3 py-3 pb-24 sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-atlas-ink sm:text-3xl">
            {dashboardTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate">
            Review session history, delete mistakes with confirmation, and manage globally renamed exercises from one place.
          </p>
        </header>

        {dashboard.pageError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {dashboard.pageError}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Atlas Intelligence
                </p>
                <h2 className="mt-2 text-xl font-semibold text-atlas-ink">
                  Prioritized guidance
                </h2>
              </div>
              {atlasDashboard.isLoading ? (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-atlas-slate">
                  Loading
                </span>
              ) : null}
            </div>

            {atlasDashboard.error ? (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {atlasDashboard.error}
              </div>
            ) : null}

            {atlasDashboard.topInsight ? (
              <article className="mt-4 rounded-[20px] border border-atlas-accent/30 bg-atlas-accent/10 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-ink">
                  <span>{atlasDashboard.topInsight.domain}</span>
                  <span className="rounded-full border border-atlas-accent/40 px-2 py-1 text-[10px]">
                    {atlasDashboard.topInsight.priority}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-atlas-ink">
                  {atlasDashboard.topInsight.content}
                </p>
              </article>
            ) : (
              !atlasDashboard.isLoading && !atlasDashboard.error ? (
                <div className="mt-4 rounded-[20px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-4 text-sm text-atlas-slate">
                  No active insights yet. Atlas will surface them here after the background jobs write fresh intelligence.
                </div>
              ) : null
            )}

            {atlasDashboard.insights.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {atlasDashboard.insights.map((insight) => (
                  <article
                    key={insight.id}
                    className="rounded-[18px] border border-atlas-line/70 bg-atlas-night/45 px-4 py-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                      {insight.domain}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-atlas-ink">
                      {insight.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                Motivation
              </p>
              <p className="mt-3 text-base leading-7 text-atlas-ink">
                {atlasDashboard.motivation?.content || 'Fresh motivation will appear here as soon as Atlas rotates a valid quote.'}
              </p>
            </section>

            <section className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
                  Quick Tips
                </p>
                <span className="text-[11px] text-atlas-slate">
                  Max 2
                </span>
              </div>

              {atlasDashboard.tips.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {atlasDashboard.tips.map((tip) => (
                    <article
                      key={tip.id}
                      className="rounded-[18px] border border-atlas-line/70 bg-atlas-night/40 px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-slate">
                        {tip.domain}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-atlas-ink">
                        {tip.content}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                !atlasDashboard.isLoading && !atlasDashboard.error ? (
                  <p className="mt-3 text-sm leading-6 text-atlas-slate">
                    No active tips yet. They will appear here after the next successful background run.
                  </p>
                ) : null
              )}
            </section>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-atlas-line/80 bg-atlas-panel p-1">
          {DASHBOARD_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`rounded-[16px] px-4 py-3 text-sm font-medium ${
                activePanel === panel.id
                  ? 'bg-atlas-accent text-white'
                  : 'text-atlas-slate'
              }`}
              onClick={() => handleSelectPanel(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {activePanel === 'templates' ? (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <TemplateList
              templates={dashboard.templates}
              selectedTemplateId={dashboard.selectedTemplateId}
              isLoading={dashboard.isLoadingDashboard}
              onSelectTemplate={dashboard.setSelectedTemplateId}
            />

            <TemplateEditor
              template={dashboard.selectedTemplate}
              isSavingTemplateName={dashboard.isSavingTemplateName}
              isDuplicatingTemplate={dashboard.isDuplicatingTemplate}
              pendingExerciseActionId={dashboard.pendingExerciseActionId}
              pendingTemplateSetId={dashboard.pendingTemplateSetId}
              pendingRenameExerciseId={dashboard.pendingRenameExerciseId}
              onRenameTemplate={dashboard.renameTemplate}
              onRenameExercise={dashboard.renameExercise}
              onDuplicateTemplate={dashboard.duplicateTemplate}
              onMoveExercise={dashboard.moveExercise}
              onToggleExercise={dashboard.toggleExercise}
              onSaveSet={dashboard.saveTemplateSet}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
            <SessionList
              sessions={dashboard.sessions}
              selectedSessionId={dashboard.selectedSessionId}
              isLoading={dashboard.isLoadingDashboard}
              pendingDeleteSessionId={dashboard.pendingDeleteSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={dashboard.deleteSession}
            />

            <SessionDetail
              sessionDetail={dashboard.sessionDetail}
              isOpen={isHistoryDrawerOpen}
              isLoadingSessionDetail={dashboard.isLoadingSessionDetail}
              pendingDeleteSessionId={dashboard.pendingDeleteSessionId}
              pendingDeleteSessionExerciseId={dashboard.pendingDeleteSessionExerciseId}
              exerciseInsightById={dashboard.exerciseInsightById}
              loadingExerciseInsightById={dashboard.loadingExerciseInsightById}
              exerciseInsightErrorById={dashboard.exerciseInsightErrorById}
              onClose={handleCloseSession}
              onDeleteSession={dashboard.deleteSession}
              onDeleteSessionExercise={dashboard.deleteSessionExercise}
              onLoadExerciseInsight={dashboard.loadExerciseInsight}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function useDashboardHashState() {
  const [routeState, setRouteState] = useState(() => parseDashboardHash(window.location.hash));

  useEffect(() => {
    function handleHashChange() {
      setRouteState(parseDashboardHash(window.location.hash));
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return routeState;
}

function setHashState({ panel, sessionId }) {
  const nextHash = sessionId
    ? `#dashboard/${panel}/${sessionId}`
    : `#dashboard/${panel}`;

  window.location.hash = nextHash;
}

function parseDashboardHash(hash) {
  const normalizedHash = String(hash || '');

  if (!normalizedHash.startsWith('#dashboard')) {
    return { panel: 'templates', sessionId: '' };
  }

  const parts = normalizedHash.replace(/^#dashboard\/?/, '').split('/').filter(Boolean);
  const panel = parts[0] === 'history' ? 'history' : 'templates';
  const sessionId = panel === 'history' ? (parts[1] || '') : '';

  return { panel, sessionId };
}
