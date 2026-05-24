import { useEffect, useState } from 'react';
import {
  addExerciseToTemplate,
  addGymExercise,
  createGymExerciseNote,
  createGymSet,
  createGymTemplateExerciseAlternate,
  deleteGymExerciseNote,
  deleteGymTemplateExerciseAlternate,
  deleteGymExercise,
  endGymSession,
  getGymExerciseNotes,
  getActiveGymSession,
  getGymExerciseHistory,
  getGymExercises,
  getGymSessionInit,
  getGymTemplateExerciseAlternates,
  getGymTemplates,
  getRecentGymExercises,
  startGymSession,
  updateGymExerciseDefaults,
  updateGymExerciseNote,
  updateGymExerciseStatus,
  updateGymSessionExerciseOverride,
  updateGymSessionExerciseTargets,
  updateGymTemplateExerciseAlternate,
  updateGymTemplateSet,
} from '../api/gymApi';

const DEFAULT_MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

function capitalizeFirstLetter(str) {
  if (!str) return str;

  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function useWorkoutSession() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [template, setTemplate] = useState(null);
  const [session, setSession] = useState(null);
  const [today, setToday] = useState('');
  const [exercises, setExercises] = useState([]);
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingSessionInit, setIsLoadingSessionInit] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [recentExercises, setRecentExercises] = useState([]);
  const [exerciseHistoryByKey, setExerciseHistoryByKey] = useState({});
  const [loadingExerciseHistoryByKey, setLoadingExerciseHistoryByKey] = useState({});
  const [attemptedExerciseHistoryByKey, setAttemptedExerciseHistoryByKey] = useState({});
  const [exerciseHistoryErrorByKey, setExerciseHistoryErrorByKey] = useState({});
  const [exerciseCatalog, setExerciseCatalog] = useState([]);
  const [isLoadingExerciseCatalog, setIsLoadingExerciseCatalog] = useState(false);
  const [exerciseNotesById, setExerciseNotesById] = useState({});
  const [loadingExerciseNotesById, setLoadingExerciseNotesById] = useState({});
  const [exerciseNotesErrorById, setExerciseNotesErrorById] = useState({});

  const isSessionEditable = session?.status === 'active';
  const activeTemplateDefinition = templates.find(
    (item) => String(item.id) === String(template?.id || selectedTemplateId || ''),
  );
  const availableMuscleGroups = Array.from(
    new Set(
      exercises
        .map((exercise) => capitalizeFirstLetter(exercise.muscle_group))
        .filter(Boolean)
        .concat(DEFAULT_MUSCLE_GROUPS),
    ),
  );
  const sessionSummary = buildSessionSummary(exercises);
  const suggestedExercises = buildSuggestedExercises({
    currentExercises: exercises,
    recentExercises,
    templateExercises: activeTemplateDefinition?.exercises || [],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsLoadingTemplates(true);
      setPageError('');

      try {
        const [templateList, activeSessionState, recentExerciseList, catalog] = await Promise.all([
          getGymTemplates(),
          getActiveGymSession(),
          getRecentGymExercises().catch(() => []),
          getGymExercises('', 100).catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setTemplates(templateList);
        setRecentExercises(recentExerciseList);
        setExerciseCatalog(catalog);

        if (activeSessionState) {
          hydrateSessionState(activeSessionState);
          return;
        }

        if (templateList.length > 0) {
          const autoSelectedTemplate = findTemplateForToday(templateList) || templateList[0];
          setSelectedTemplateId(String(autoSelectedTemplate.id));
        }
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load workout data');
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplateId || session?.status === 'active') {
      return;
    }

    void refreshSessionInit(selectedTemplateId);
  }, [selectedTemplateId, session?.status]);

  async function refreshSessionInit(templateId = selectedTemplateId) {
    if (!templateId) {
      return;
    }

    setIsLoadingSessionInit(true);
    setPageError('');

    try {
      const initData = await getGymSessionInit(templateId);
      hydrateSessionState(initData);
    } catch (error) {
      setPageError(error.message || 'Failed to load workout session');
    } finally {
      setIsLoadingSessionInit(false);
    }
  }

  async function handleStartSession() {
    if (!selectedTemplateId || isStartingSession || session?.status === 'active') {
      return;
    }

    setIsStartingSession(true);
    setPageError('');

    try {
      await startGymSession({
        templateId: Number(selectedTemplateId),
      });

      const activeSessionState = await getActiveGymSession();
      if (activeSessionState) {
        hydrateSessionState(activeSessionState);
      }
    } catch (error) {
      setPageError(error.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  }

  async function handleEndSession() {
    if (!session || session.status !== 'active' || isEndingSession) {
      return false;
    }

    setIsEndingSession(true);
    setPageError('');

    try {
      const completedSession = await endGymSession(session.id);
      setSession(completedSession);
      return true;
    } catch (error) {
      setPageError(error.message || 'Failed to end workout');
      return false;
    } finally {
      setIsEndingSession(false);
    }
  }

  async function handleAddExercise({
    exerciseId = null,
    exerciseName,
    muscleGroup,
    targetSets,
    repMin,
    repMax,
    targetRir,
    addToTemplate = false,
  }) {
    if (!session || !isSessionEditable || isAddingExercise) {
      return false;
    }

    setIsAddingExercise(true);
    setPageError('');

    try {
      const createdExercise = await addGymExercise({
        sessionId: session.id,
        exerciseId,
        exerciseName,
        muscleGroup,
        targetSets,
        repMin,
        repMax,
        targetRir,
      });

      if (addToTemplate && template?.id) {
        await addExerciseToTemplate({
          templateId: template.id,
          exerciseId: createdExercise.effective_exercise_id || exerciseId,
          exerciseName: createdExercise.exercise_name,
          muscleGroup: createdExercise.muscle_group,
          targetSets: createdExercise.target_sets,
          repMin: createdExercise.rep_min,
          repMax: createdExercise.rep_max,
          targetRir: createdExercise.target_rir,
        });
        setTemplates(await getGymTemplates());
      }

      setExercises((currentExercises) => {
        const existingExercise = currentExercises.find(
          (exercise) => exercise.session_exercise_id === createdExercise.session_exercise_id,
        );

        if (existingExercise) {
          setOpenExerciseId(createdExercise.session_exercise_id);
          return currentExercises;
        }

        const nextExercises = [...currentExercises, createdExercise].sort(
          (left, right) => left.order_index - right.order_index,
        );

        setOpenExerciseId(createdExercise.session_exercise_id);
        return nextExercises;
      });
      setRecentExercises((currentExercises) =>
        mergeRecentExercises([
          {
            exercise_id: createdExercise.effective_exercise_id,
            exercise_name: createdExercise.exercise_name,
            muscle_group: createdExercise.muscle_group,
          },
          ...currentExercises,
        ]),
      );
      return true;
    } catch (error) {
      setPageError(error.message || 'Failed to add exercise');
      return false;
    } finally {
      setIsAddingExercise(false);
    }
  }

  async function handleRemoveExercise(sessionExerciseId) {
    try {
      await deleteGymExercise(sessionExerciseId);

      setExercises((currentExercises) => {
        const nextExercises = currentExercises.filter(
          (exercise) => exercise.session_exercise_id !== sessionExerciseId,
        );
        setOpenExerciseId(findNextOpenExerciseId(nextExercises));
        return nextExercises;
      });
    } catch (error) {
      setPageError(error.message || 'Failed to remove exercise');
    }
  }

  async function handleUpdateExerciseStatus(sessionExerciseId, status) {
    try {
      const updatedExercise = await updateGymExerciseStatus(sessionExerciseId, status);

      setExercises((currentExercises) => {
        const nextExercises = currentExercises.map((exercise) =>
          exercise.session_exercise_id === sessionExerciseId
            ? {
                ...exercise,
                status: updatedExercise.status,
              }
            : exercise,
        );

        if (status === 'completed' || status === 'skipped') {
          setOpenExerciseId(findNextOpenExerciseId(nextExercises, sessionExerciseId));
        }

        return nextExercises;
      });

      return updatedExercise;
    } catch (error) {
      setPageError(error.message || 'Failed to update exercise status');
      return null;
    }
  }

  async function handleSaveSet(sessionExerciseId, rowPayload) {
    const createdSet = await createGymSet({
      exerciseId: sessionExerciseId,
      setNumber: rowPayload.setNumber,
      weight: Number(rowPayload.weight),
      reps: rowPayload.reps === '' ? null : Number(rowPayload.reps),
      rir: rowPayload.rir === '' ? null : Number(rowPayload.rir),
    });

    let shouldMarkCompleted = false;

    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.session_exercise_id !== sessionExerciseId) {
          return exercise;
        }

        const nextSets = [...exercise.sets.filter((set) => set.set_number !== createdSet.set_number), createdSet]
          .sort((left, right) => left.set_number - right.set_number);

        if (nextSets.length >= exercise.target_sets && exercise.status !== 'completed') {
          shouldMarkCompleted = true;
        }

        return {
          ...exercise,
          sets: nextSets,
        };
      }),
    );

    if (shouldMarkCompleted) {
      try {
        await handleUpdateExerciseStatus(sessionExerciseId, 'completed');
      } catch (_) {
        // shared page error already covers failures
      }
    }

    return createdSet;
  }

  async function handleAddExerciseToTemplate(exercise) {
    if (!template || !exercise.can_add_to_template) {
      return;
    }

    try {
      await addExerciseToTemplate({
        templateId: template.id,
        exerciseId: exercise.effective_exercise_id || exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        muscleGroup: exercise.muscle_group,
        targetSets: exercise.target_sets,
        repMin: exercise.rep_min,
        repMax: exercise.rep_max,
        targetRir: exercise.target_rir,
      });

      setExercises((currentExercises) =>
        currentExercises.map((currentExercise) =>
          currentExercise.session_exercise_id === exercise.session_exercise_id
            ? {
                ...currentExercise,
                can_add_to_template: false,
              }
            : currentExercise,
        ),
      );
      setTemplates(await getGymTemplates());
    } catch (error) {
      setPageError(error.message || 'Failed to add exercise to template');
    }
  }

  async function handleLoadExerciseHistory(exercise) {
    const historyKey = getHistoryKey(exercise);

    if (
      !historyKey
      || loadingExerciseHistoryByKey[historyKey]
      || attemptedExerciseHistoryByKey[historyKey]
    ) {
      return;
    }

    if (!exercise.effective_exercise_id) {
      return;
    }

    setAttemptedExerciseHistoryByKey((currentState) => ({
      ...currentState,
      [historyKey]: true,
    }));
    setLoadingExerciseHistoryByKey((currentState) => ({
      ...currentState,
      [historyKey]: true,
    }));

    try {
      const history = await getGymExerciseHistory(exercise.effective_exercise_id, {
        limit: 3,
      });

      setExerciseHistoryByKey((currentState) => ({
        ...currentState,
        [historyKey]: groupExerciseHistory(history).slice(0, 3),
      }));
      setExerciseHistoryErrorByKey((currentState) => ({
        ...currentState,
        [historyKey]: '',
      }));
    } catch (error) {
      setExerciseHistoryByKey((currentState) => ({
        ...currentState,
        [historyKey]: [],
      }));
      setExerciseHistoryErrorByKey((currentState) => ({
        ...currentState,
        [historyKey]: error.message || 'History unavailable',
      }));
    } finally {
      setLoadingExerciseHistoryByKey((currentState) => ({
        ...currentState,
        [historyKey]: false,
      }));
    }
  }

  async function refreshAlternates(templateExerciseId) {
    if (!templateExerciseId) {
      return [];
    }

    const alternates = await getGymTemplateExerciseAlternates(templateExerciseId);

    setExercises((currentExercises) =>
      currentExercises.map((exercise) =>
        exercise.template_exercise_id === templateExerciseId
          ? {
              ...exercise,
              alternates,
            }
          : exercise,
      ),
    );
    setTemplates((currentTemplates) =>
      currentTemplates.map((currentTemplate) => ({
        ...currentTemplate,
        exercises: currentTemplate.exercises.map((exercise) =>
          exercise.template_exercise_id === templateExerciseId
            ? {
                ...exercise,
                alternates,
              }
            : exercise,
        ),
      })),
    );

    return alternates;
  }

  async function handleSearchExerciseCatalog(search = '') {
    setIsLoadingExerciseCatalog(true);

    try {
      const nextCatalog = await getGymExercises(search, 100);
      setExerciseCatalog(nextCatalog);
      return nextCatalog;
    } catch (error) {
      setPageError(error.message || 'Failed to load exercises');
      return [];
    } finally {
      setIsLoadingExerciseCatalog(false);
    }
  }

  async function handleCreateAlternate(templateExerciseId, payload) {
    try {
      const alternates = await createGymTemplateExerciseAlternate(templateExerciseId, payload);
      setExercises((currentExercises) =>
        currentExercises.map((exercise) =>
          exercise.template_exercise_id === templateExerciseId
            ? {
                ...exercise,
                alternates,
              }
            : exercise,
        ),
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((currentTemplate) => ({
          ...currentTemplate,
          exercises: currentTemplate.exercises.map((exercise) =>
            exercise.template_exercise_id === templateExerciseId
              ? {
                  ...exercise,
                  alternates,
                }
              : exercise,
          ),
        })),
      );
      setExerciseCatalog((currentCatalog) => mergeExerciseCatalog(currentCatalog, alternates));
      return alternates;
    } catch (error) {
      setPageError(error.message || 'Failed to add alternate');
      throw error;
    }
  }

  async function handleSwapExercise(sessionExerciseId, overrideAlternateId, confirmKeepLoggedSets = false) {
    try {
      const updatedExercise = await updateGymSessionExerciseOverride(sessionExerciseId, {
        override_alternate_id: overrideAlternateId,
        confirm_keep_logged_sets: confirmKeepLoggedSets,
      });

      setExercises((currentExercises) =>
        currentExercises.map((exercise) =>
          exercise.session_exercise_id === sessionExerciseId
            ? {
                ...exercise,
                ...updatedExercise,
              }
            : exercise,
        ),
      );
      return { type: 'updated', exercise: updatedExercise };
    } catch (error) {
      if (error.data?.type === 'confirmation_required') {
        return error.data;
      }

      setPageError(error.message || 'Failed to swap exercise');
      throw error;
    }
  }

  async function handleUpdateSessionTargets(sessionExerciseId, targets) {
    try {
      const updatedExercise = await updateGymSessionExerciseTargets(sessionExerciseId, toApiTargets(targets));

      setExercises((currentExercises) =>
        currentExercises.map((exercise) =>
          exercise.session_exercise_id === sessionExerciseId
            ? {
                ...exercise,
                ...updatedExercise,
              }
            : exercise,
        ),
      );

      return updatedExercise;
    } catch (error) {
      setPageError(error.message || 'Failed to update exercise targets');
      throw error;
    }
  }

  async function handleSaveTargetsToTemplate(exercise, targets) {
    if (!exercise?.template_set_id) {
      await handleAddExerciseToTemplate({
        ...exercise,
        target_sets: targets.targetSets,
        rep_min: targets.repMin,
        rep_max: targets.repMax,
        target_rir: targets.targetRir,
      });
      return null;
    }

    try {
      const updatedSet = await updateGymTemplateSet(exercise.template_set_id, toApiTargets(targets));
      setTemplates(await getGymTemplates());
      return updatedSet;
    } catch (error) {
      setPageError(error.message || 'Failed to save future targets');
      throw error;
    }
  }

  async function handleSaveExerciseDefaults(exercise, targets) {
    const exerciseId = exercise?.effective_exercise_id || exercise?.exercise_id;

    if (!exerciseId) {
      return null;
    }

    try {
      const updatedExercise = await updateGymExerciseDefaults(exerciseId, toApiTargets(targets));
      setExerciseCatalog((currentCatalog) =>
        currentCatalog.map((catalogExercise) =>
          Number(catalogExercise.id) === Number(updatedExercise.id)
            ? {
                ...catalogExercise,
                ...updatedExercise,
              }
            : catalogExercise,
        ),
      );
      return updatedExercise;
    } catch (error) {
      setPageError(error.message || 'Failed to save exercise defaults');
      throw error;
    }
  }

  async function handleLoadExerciseNotes(exercise) {
    const exerciseId = Number(exercise?.effective_exercise_id || exercise?.exercise_id || 0);

    if (!exerciseId || loadingExerciseNotesById[exerciseId]) {
      return [];
    }

    if (exerciseNotesById[exerciseId]) {
      return exerciseNotesById[exerciseId];
    }

    setLoadingExerciseNotesById((currentState) => ({
      ...currentState,
      [exerciseId]: true,
    }));

    try {
      const notes = await getGymExerciseNotes(exerciseId);
      setExerciseNotesById((currentState) => ({
        ...currentState,
        [exerciseId]: notes,
      }));
      setExerciseNotesErrorById((currentState) => ({
        ...currentState,
        [exerciseId]: '',
      }));
      syncPinnedNote(exerciseId, notes);
      return notes;
    } catch (error) {
      setExerciseNotesErrorById((currentState) => ({
        ...currentState,
        [exerciseId]: error.message || 'Failed to load notes',
      }));
      return [];
    } finally {
      setLoadingExerciseNotesById((currentState) => ({
        ...currentState,
        [exerciseId]: false,
      }));
    }
  }

  async function handleCreateExerciseNote(exercise, body) {
    const exerciseId = Number(exercise?.effective_exercise_id || exercise?.exercise_id || 0);

    if (!exerciseId) {
      return null;
    }

    const createdNote = await createGymExerciseNote(exerciseId, {
      body,
      is_pinned: true,
    });
    const notes = await getGymExerciseNotes(exerciseId);
    setExerciseNotesById((currentState) => ({
      ...currentState,
      [exerciseId]: notes,
    }));
    syncPinnedNote(exerciseId, notes);
    return createdNote;
  }

  async function handleUpdateExerciseNote(exercise, noteId, payload) {
    const exerciseId = Number(exercise?.effective_exercise_id || exercise?.exercise_id || 0);

    if (!exerciseId) {
      return null;
    }

    const updatedNote = await updateGymExerciseNote(exerciseId, noteId, payload);
    const notes = await getGymExerciseNotes(exerciseId);
    setExerciseNotesById((currentState) => ({
      ...currentState,
      [exerciseId]: notes,
    }));
    syncPinnedNote(exerciseId, notes);
    return updatedNote;
  }

  async function handleDeleteExerciseNote(exercise, noteId) {
    const exerciseId = Number(exercise?.effective_exercise_id || exercise?.exercise_id || 0);

    if (!exerciseId) {
      return false;
    }

    await deleteGymExerciseNote(exerciseId, noteId);
    const notes = await getGymExerciseNotes(exerciseId);
    setExerciseNotesById((currentState) => ({
      ...currentState,
      [exerciseId]: notes,
    }));
    syncPinnedNote(exerciseId, notes);
    return true;
  }

  async function handleUpdateAlternate(alternateId, targets) {
    try {
      const alternates = await updateGymTemplateExerciseAlternate(alternateId, toApiTargets(targets));
      syncAlternates(alternates);
      return alternates;
    } catch (error) {
      setPageError(error.message || 'Failed to update alternate');
      throw error;
    }
  }

  async function handleDeleteAlternate(alternateId, templateExerciseId) {
    try {
      const alternates = await deleteGymTemplateExerciseAlternate(alternateId);
      syncAlternates(alternates, templateExerciseId);
      return alternates;
    } catch (error) {
      setPageError(error.message || 'Failed to delete alternate');
      throw error;
    }
  }

  function hydrateSessionState(state) {
    setTemplate(state.template);
    setSession(state.current_session);
    setToday(state.today || '');
    setExercises(state.exercises || []);
    setExerciseHistoryByKey({});
    setLoadingExerciseHistoryByKey({});
    setAttemptedExerciseHistoryByKey({});
    setExerciseHistoryErrorByKey({});
    setExerciseNotesById({});
    setLoadingExerciseNotesById({});
    setExerciseNotesErrorById({});
    setSelectedTemplateId(state.template ? String(state.template.id) : '');
    setOpenExerciseId(findNextOpenExerciseId(state.exercises || []));
  }

  function syncAlternates(alternates, fallbackTemplateExerciseId = null) {
    const templateExerciseId = Number(alternates?.[0]?.template_exercise_id || fallbackTemplateExerciseId || 0);

    if (!templateExerciseId) {
      return;
    }

    setExercises((currentExercises) =>
      currentExercises.map((exercise) =>
        exercise.template_exercise_id === templateExerciseId
          ? {
              ...exercise,
              alternates,
            }
          : exercise,
      ),
    );
    setTemplates((currentTemplates) =>
      currentTemplates.map((currentTemplate) => ({
        ...currentTemplate,
        exercises: currentTemplate.exercises.map((exercise) =>
          exercise.template_exercise_id === templateExerciseId
            ? {
                ...exercise,
                alternates,
              }
            : exercise,
        ),
      })),
    );
  }

  function syncPinnedNote(exerciseId, notes) {
    const pinnedNote = notes.find((note) => note.is_pinned) || notes[0] || null;
    const normalizedExerciseId = Number(exerciseId);

    setExercises((currentExercises) =>
      currentExercises.map((exercise) =>
        Number(exercise.effective_exercise_id || exercise.exercise_id || 0) === normalizedExerciseId
          ? {
              ...exercise,
              pinned_note: pinnedNote,
            }
          : exercise,
      ),
    );
    setTemplates((currentTemplates) =>
      currentTemplates.map((currentTemplate) => ({
        ...currentTemplate,
        exercises: currentTemplate.exercises.map((exercise) =>
          Number(exercise.exercise_id || 0) === normalizedExerciseId
            ? {
                ...exercise,
                pinned_note: pinnedNote,
              }
            : exercise,
        ),
      })),
    );
  }

  return {
    templates,
    selectedTemplateId,
    template,
    session,
    today,
    exercises,
    openExerciseId,
    pageError,
    isLoadingTemplates,
    isLoadingSessionInit,
    isStartingSession,
    isAddingExercise,
    isEndingSession,
    isSessionEditable,
    availableMuscleGroups,
    recentExercises,
    suggestedExercises,
    sessionSummary,
    exerciseHistoryByKey,
    loadingExerciseHistoryByKey,
    exerciseHistoryErrorByKey,
    exerciseCatalog,
    isLoadingExerciseCatalog,
    exerciseNotesById,
    loadingExerciseNotesById,
    exerciseNotesErrorById,
    isWorkoutComplete: exercises.length > 0 && exercises.every(isExerciseResolved),
    setSelectedTemplateId,
    setOpenExerciseId,
    startSession: handleStartSession,
    endSession: handleEndSession,
    addExercise: handleAddExercise,
    removeExercise: handleRemoveExercise,
    updateExerciseStatus: handleUpdateExerciseStatus,
    saveSet: handleSaveSet,
    updateSessionTargets: handleUpdateSessionTargets,
    saveTargetsToTemplate: handleSaveTargetsToTemplate,
    saveExerciseDefaults: handleSaveExerciseDefaults,
    addSessionExerciseToTemplate: handleAddExerciseToTemplate,
    loadExerciseHistory: handleLoadExerciseHistory,
    loadExerciseNotes: handleLoadExerciseNotes,
    createExerciseNote: handleCreateExerciseNote,
    updateExerciseNote: handleUpdateExerciseNote,
    deleteExerciseNote: handleDeleteExerciseNote,
    loadAlternates: refreshAlternates,
    searchExerciseCatalog: handleSearchExerciseCatalog,
    createAlternate: handleCreateAlternate,
    updateAlternate: handleUpdateAlternate,
    deleteAlternate: handleDeleteAlternate,
    swapExercise: handleSwapExercise,
  };
}

function findTemplateForToday(templates) {
  const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

  return (
    templates.find(
      (template) => String(template.day || '').trim().toLowerCase() === todayLabel.toLowerCase(),
    ) || null
  );
}

function findNextOpenExerciseId(exercises, currentExerciseId = null) {
  const currentIndex = currentExerciseId
    ? exercises.findIndex((exercise) => exercise.session_exercise_id === currentExerciseId)
    : -1;
  const afterCurrent = currentIndex >= 0 ? exercises.slice(currentIndex + 1) : exercises;
  const nextExercise = afterCurrent.find((exercise) => !isExerciseResolved(exercise));

  if (nextExercise) {
    return nextExercise.session_exercise_id || nextExercise.template_exercise_id;
  }

  const firstPending = exercises.find((exercise) => !isExerciseResolved(exercise));
  return firstPending
    ? firstPending.session_exercise_id || firstPending.template_exercise_id
    : null;
}

function isExerciseResolved(exercise) {
  return exercise.status === 'completed' || exercise.status === 'skipped';
}

function buildSessionSummary(exercises) {
  const total = exercises.length;
  const completed = exercises.filter((exercise) => exercise.status === 'completed').length;
  const skipped = exercises.filter((exercise) => exercise.status === 'skipped').length;
  const pending = total - completed - skipped;

  return {
    total,
    completed,
    skipped,
    pending,
    percentComplete: total === 0 ? 0 : Math.round(((completed + skipped) / total) * 100),
    unresolvedExercises: exercises.filter((exercise) => !isExerciseResolved(exercise)),
  };
}

function buildSuggestedExercises({ currentExercises, recentExercises, templateExercises }) {
  const currentNames = new Set(currentExercises.map(getExerciseIdentity).filter(Boolean));
  const suggestions = [];
  const seenNames = new Set(currentNames);

  for (const exercise of templateExercises) {
    if (exercise.is_active === false) {
      continue;
    }

    const normalizedName = getExerciseIdentity(exercise);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    suggestions.push({
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name,
      muscle_group: exercise.muscle_group || '',
      source: 'template',
    });
  }

  for (const exercise of recentExercises) {
    const normalizedName = getExerciseIdentity(exercise);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    suggestions.push({
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name,
      muscle_group: exercise.muscle_group || '',
      source: 'recent',
    });
  }

  return suggestions.slice(0, 10);
}

function mergeRecentExercises(exercises) {
  const seenNames = new Set();
  const recentExercises = [];

  for (const exercise of exercises) {
    const normalizedName = getExerciseIdentity(exercise);

    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    recentExercises.push(exercise);
  }

  return recentExercises.slice(0, 12);
}

function mergeExerciseCatalog(currentCatalog, alternates) {
  const merged = [...currentCatalog];
  const seen = new Set(currentCatalog.map((exercise) => Number(exercise.id)));

  for (const alternate of alternates) {
    const exerciseId = Number(alternate.exercise_id || alternate.id);

    if (seen.has(exerciseId)) {
      continue;
    }

    seen.add(exerciseId);
    merged.push({
      id: exerciseId,
      name: alternate.exercise_name,
      muscle_group: alternate.muscle_group || '',
    });
  }

  return merged.sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function groupExerciseHistory(historyRows) {
  const groupedHistory = new Map();

  for (const row of historyRows) {
    const currentEntry = groupedHistory.get(row.date);

    if (currentEntry) {
      currentEntry.sets.push(row);
      continue;
    }

    groupedHistory.set(row.date, {
      date: row.date,
      sets: [row],
    });
  }

  return Array.from(groupedHistory.values()).map((entry) => ({
    ...entry,
    sets: entry.sets.sort((left, right) => left.set_number - right.set_number),
  }));
}

function toApiTargets(targets) {
  return {
    target_sets: Number(targets.targetSets ?? targets.target_sets),
    rep_min: targets.repMin === '' || targets.repMin === undefined
      ? null
      : targets.repMin,
    rep_max: targets.repMax === '' || targets.repMax === undefined
      ? null
      : targets.repMax,
    target_rir: targets.targetRir === '' || targets.targetRir === undefined
      ? null
      : targets.targetRir,
  };
}

function normalizeExerciseName(value) {
  return String(value || '').trim().toLowerCase();
}

function getExerciseIdentity(exercise) {
  const exerciseId = Number(exercise?.exercise_id || exercise?.effective_exercise_id || 0);

  if (exerciseId > 0) {
    return `id:${exerciseId}`;
  }

  return normalizeExerciseName(exercise?.exercise_name);
}

function getHistoryKey(exercise) {
  if (!exercise?.effective_exercise_id) {
    return '';
  }

  return `${exercise.effective_exercise_id}:${exercise.session_exercise_id || exercise.template_exercise_id || 'preview'}`;
}
