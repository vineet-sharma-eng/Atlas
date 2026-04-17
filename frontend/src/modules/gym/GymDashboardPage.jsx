import { useEffect, useMemo } from 'react';
import { useGymDashboard } from '../../hooks/useGymDashboard';
import { SessionDetail } from './components/dashboard/SessionDetail';
import { SessionList } from './components/dashboard/SessionList';
import { TemplateEditor } from './components/dashboard/TemplateEditor';
import { TemplateList } from './components/dashboard/TemplateList';

export function GymDashboardPage({ panel = 'history', sessionId = '' }) {
  const dashboard = useGymDashboard();

  useEffect(() => {
    if (panel !== 'history') {
      return;
    }

    dashboard.setSelectedSessionId(sessionId);
  }, [dashboard, panel, sessionId]);

  const isHistoryDrawerOpen = panel === 'history' && Boolean(dashboard.selectedSessionId);
  const dashboardTitle = useMemo(
    () => (panel === 'templates' ? 'Template editor' : 'History'),
    [panel],
  );

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
            Gym
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

        {panel === 'templates' ? (
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

function setHashState({ panel, sessionId }) {
  const nextHash = sessionId
    ? `#gym/${panel}/${sessionId}`
    : `#gym/${panel}`;

  window.location.hash = nextHash;
}
