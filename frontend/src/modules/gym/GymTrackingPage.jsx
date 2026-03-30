import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { TemplateSelector } from './components/TemplateSelector';
import { WorkoutView } from './components/WorkoutView';

export function GymTrackingPage() {
  const workoutSession = useWorkoutSession();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[24px] border border-atlas-line/70 bg-atlas-panel px-5 py-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Atlas Gym
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-atlas-ink sm:text-4xl">
            Workout session
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-slate sm:text-base">
            Templates stay stable, sessions stay editable, and the last matching session is used
            only to prefill suggestions.
          </p>
        </header>

        {workoutSession.pageError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {workoutSession.pageError}
          </div>
        ) : null}

        <TemplateSelector
          templates={workoutSession.templates}
          selectedTemplateId={workoutSession.selectedTemplateId}
          template={workoutSession.template}
          session={workoutSession.session}
          today={workoutSession.today}
          isLoadingTemplates={workoutSession.isLoadingTemplates}
          isLoadingSessionInit={workoutSession.isLoadingSessionInit}
          isStartingSession={workoutSession.isStartingSession}
          onChangeTemplate={workoutSession.setSelectedTemplateId}
          onStartSession={workoutSession.startSession}
        />

        <WorkoutView
          template={workoutSession.template}
          session={workoutSession.session}
          exercises={workoutSession.exercises}
          openExerciseId={workoutSession.openExerciseId}
          availableMuscleGroups={workoutSession.availableMuscleGroups}
          isLoading={workoutSession.isLoadingSessionInit}
          isAddingExercise={workoutSession.isAddingExercise}
          isEndingSession={workoutSession.isEndingSession}
          isSessionEditable={workoutSession.isSessionEditable}
          isWorkoutComplete={workoutSession.isWorkoutComplete}
          onOpenExercise={workoutSession.setOpenExerciseId}
          onAddExercise={workoutSession.addExercise}
          onRemoveExercise={workoutSession.removeExercise}
          onUpdateExerciseStatus={workoutSession.updateExerciseStatus}
          onSaveSet={workoutSession.saveSet}
          onEndSession={workoutSession.endSession}
          onAddExerciseToTemplate={workoutSession.addSessionExerciseToTemplate}
        />
      </div>
    </main>
  );
}
