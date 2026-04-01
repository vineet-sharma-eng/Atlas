import { useEffect, useMemo, useState } from 'react';
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
