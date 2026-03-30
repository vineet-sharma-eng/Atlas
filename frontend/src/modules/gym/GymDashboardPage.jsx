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
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel px-5 py-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Atlas Gym
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-atlas-ink sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate sm:text-base">
            Manage template structure safely and inspect completed session history without mutating execution data.
          </p>
        </header>

        {dashboard.pageError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dashboard.pageError}
          </div>
        ) : null}

        <div className="flex gap-3">
          {DASHBOARD_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                activePanel === panel.id
                  ? 'bg-atlas-night text-white'
                  : 'border border-atlas-line bg-atlas-panel text-atlas-ink'
              }`}
              onClick={() => setActivePanel(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {activePanel === 'templates' ? (
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
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
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
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
