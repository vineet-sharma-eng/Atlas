import { useState } from 'react';
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
  const [activePanel, setActivePanel] = useState('templates');

  return (
    <main className="min-h-screen px-3 py-3 pb-10 sm:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-atlas-ink sm:text-3xl">
            Templates and history
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate">
            Review session history and adjust template structure without touching completed workouts.
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
              onClick={() => setActivePanel(panel.id)}
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
              onRenameTemplate={dashboard.renameTemplate}
              onDuplicateTemplate={dashboard.duplicateTemplate}
              onMoveExercise={dashboard.moveExercise}
              onToggleExercise={dashboard.toggleExercise}
              onSaveSet={dashboard.saveTemplateSet}
            />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <SessionList
              sessions={dashboard.sessions}
              selectedSessionId={dashboard.selectedSessionId}
              isLoading={dashboard.isLoadingDashboard}
              onSelectSession={dashboard.setSelectedSessionId}
            />

            <SessionDetail
              sessionDetail={dashboard.sessionDetail}
              selectedExerciseName={dashboard.selectedExerciseName}
              exerciseHistory={dashboard.exerciseHistory}
              exerciseProgress={dashboard.exerciseProgress}
              isLoadingSessionDetail={dashboard.isLoadingSessionDetail}
              isLoadingExerciseHistory={dashboard.isLoadingExerciseHistory}
              onSelectExercise={dashboard.setSelectedExerciseName}
            />
          </div>
        )}
      </div>
    </main>
  );
}
