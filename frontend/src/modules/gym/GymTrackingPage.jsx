import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { TemplateSelector } from './components/TemplateSelector';
import { WorkoutView } from './components/WorkoutView';

export function GymTrackingPage() {
  const workoutSession = useWorkoutSession();

  return (
    <main className="min-h-screen px-3 py-3 pb-24 sm:px-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="rounded-[22px] border border-atlas-line/80 bg-atlas-panel px-4 py-4 shadow-panel">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-slate">
            Workout
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-atlas-ink sm:text-3xl">
            Fast logging
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-atlas-slate">
            Compact mobile logging with slot-specific alternates and previous-day history only.
          </p>
        </header>

        {workoutSession.pageError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
          today={workoutSession.today}
          exercises={workoutSession.exercises}
          openExerciseId={workoutSession.openExerciseId}
          availableMuscleGroups={workoutSession.availableMuscleGroups}
          suggestedExercises={workoutSession.suggestedExercises}
          sessionSummary={workoutSession.sessionSummary}
          exerciseHistoryByKey={workoutSession.exerciseHistoryByKey}
          loadingExerciseHistoryByKey={workoutSession.loadingExerciseHistoryByKey}
          exerciseHistoryErrorByKey={workoutSession.exerciseHistoryErrorByKey}
          isLoading={workoutSession.isLoadingSessionInit}
          isAddingExercise={workoutSession.isAddingExercise}
          isEndingSession={workoutSession.isEndingSession}
          isSessionEditable={workoutSession.isSessionEditable}
          isWorkoutComplete={workoutSession.isWorkoutComplete}
          exerciseCatalog={workoutSession.exerciseCatalog}
          isLoadingExerciseCatalog={workoutSession.isLoadingExerciseCatalog}
          exerciseNotesById={workoutSession.exerciseNotesById}
          loadingExerciseNotesById={workoutSession.loadingExerciseNotesById}
          exerciseNotesErrorById={workoutSession.exerciseNotesErrorById}
          onOpenExercise={workoutSession.setOpenExerciseId}
          onAddExercise={workoutSession.addExercise}
          onRemoveExercise={workoutSession.removeExercise}
          onUpdateExerciseStatus={workoutSession.updateExerciseStatus}
          onSaveSet={workoutSession.saveSet}
          onUpdateSessionTargets={workoutSession.updateSessionTargets}
          onSaveTargetsToTemplate={workoutSession.saveTargetsToTemplate}
          onSaveExerciseDefaults={workoutSession.saveExerciseDefaults}
          onEndSession={workoutSession.endSession}
          onAddExerciseToTemplate={workoutSession.addSessionExerciseToTemplate}
          onLoadExerciseHistory={workoutSession.loadExerciseHistory}
          onLoadExerciseNotes={workoutSession.loadExerciseNotes}
          onCreateExerciseNote={workoutSession.createExerciseNote}
          onUpdateExerciseNote={workoutSession.updateExerciseNote}
          onDeleteExerciseNote={workoutSession.deleteExerciseNote}
          onLoadAlternates={workoutSession.loadAlternates}
          onSearchExerciseCatalog={workoutSession.searchExerciseCatalog}
          onCreateAlternate={workoutSession.createAlternate}
          onUpdateAlternate={workoutSession.updateAlternate}
          onDeleteAlternate={workoutSession.deleteAlternate}
          onSwapExercise={workoutSession.swapExercise}
        />
      </div>
    </main>
  );
}
