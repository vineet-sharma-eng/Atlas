import { useEffect, useState } from 'react';
import {
  addExerciseToTemplate,
  addGymExercise,
  createGymSet,
  deleteGymExercise,
  endGymSession,
  getActiveGymSession,
  getGymExerciseHistory,
  getGymSessionInit,
  getGymTemplates,
  getRecentGymExercises,
  startGymSession,
  updateGymExerciseStatus,
} from '../api/gymApi';

const DEFAULT_MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

export function useWorkoutSession() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [template, setTemplate] = useState(null);
  const [session, setSession] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingSessionInit, setIsLoadingSessionInit] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [recentExercises, setRecentExercises] = useState([]);
  const [exerciseHistoryByName, setExerciseHistoryByName] = useState({});
  const [loadingExerciseHistoryByName, setLoadingExerciseHistoryByName] = useState({});

  const today = new Date().toISOString().slice(0, 10);
  const isSessionEditable = session?.status === 'active';
  const activeTemplateDefinition = templates.find(
    (item) => String(item.id) === String(template?.id || selectedTemplateId || ''),
  );
  const availableMuscleGroups = Array.from(
    new Set(
      exercises
        .map((exercise) => exercise.muscle_group)
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
        const [templateList, activeSessionState, recentExerciseList] = await Promise.all([
          getGymTemplates(),
          getActiveGymSession(),
          getRecentGymExercises().catch(() => []),
        ]);

        if (!isMounted) {
          return;
        }

        setTemplates(templateList);
        setRecentExercises(recentExerciseList);

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
  }, [selectedTemplateId]);

  async function refreshSessionInit(templateId = selectedTemplateId) {
    if (!templateId) {
      return;
    }

    setIsLoadingSessionInit(true);
    setPageError('');

    try {
      const initData = await getGymSessionInit(templateId, today);
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
        date: today,
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
      return;
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

  async function handleAddExercise({ exerciseName, muscleGroup }) {
    if (!session || !isSessionEditable || isAddingExercise) {
      return;
    }

    setIsAddingExercise(true);
    setPageError('');

    try {
      const createdExercise = await addGymExercise({
        sessionId: session.id,
        exerciseName,
        muscleGroup,
      });

      setExercises((currentExercises) => {
        const existingExercise = currentExercises.find(
          (exercise) => exercise.session_exercise_id === createdExercise.session_exercise_id,
        );

        if (existingExercise) {
          setOpenExerciseId(createdExercise.session_exercise_id);
          return currentExercises;
        }

        const nextExercises = [
          ...currentExercises,
          {
            template_exercise_id: null,
            session_exercise_id: createdExercise.session_exercise_id,
            exercise_name: createdExercise.exercise_name,
            muscle_group: createdExercise.muscle_group,
            order_index: createdExercise.order_index,
            target_sets: 3,
            rep_min: 8,
            rep_max: 12,
            notes: '',
            status: createdExercise.status || 'pending',
            source: 'session',
            can_add_to_template: true,
            sets: [],
            prefill_sets: buildEmptyPrefillSets(3),
          },
        ];

        setOpenExerciseId(createdExercise.session_exercise_id);
        return nextExercises;
      });
      setRecentExercises((currentExercises) =>
        mergeRecentExercises([
          {
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

    setExercises((currentExercises) => {
      const nextExercises = currentExercises.map((exercise) => {
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
      });

      return nextExercises;
    });

    if (shouldMarkCompleted) {
      try {
        await handleUpdateExerciseStatus(sessionExerciseId, 'completed');
      } catch (error) {
        setPageError(error.message || 'Failed to update exercise status');
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
        exerciseName: exercise.exercise_name,
        muscleGroup: exercise.muscle_group,
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
    } catch (error) {
      setPageError(error.message || 'Failed to add exercise to template');
    }
  }

  async function handleLoadExerciseHistory(exerciseName) {
    const normalizedName = normalizeExerciseName(exerciseName);

    if (!normalizedName || exerciseHistoryByName[normalizedName] || loadingExerciseHistoryByName[normalizedName]) {
      return;
    }

    setLoadingExerciseHistoryByName((currentState) => ({
      ...currentState,
      [normalizedName]: true,
    }));

    try {
      const history = await getGymExerciseHistory(exerciseName);
      setExerciseHistoryByName((currentState) => ({
        ...currentState,
        [normalizedName]: groupExerciseHistory(history).slice(0, 3),
      }));
    } catch (error) {
      setPageError(error.message || 'Failed to load exercise history');
    } finally {
      setLoadingExerciseHistoryByName((currentState) => ({
        ...currentState,
        [normalizedName]: false,
      }));
    }
  }

  function hydrateSessionState(state) {
    setTemplate(state.template);
    setSession(state.current_session);
    setExercises(state.exercises);
    setSelectedTemplateId(state.template ? String(state.template.id) : '');
    setOpenExerciseId(findNextOpenExerciseId(state.exercises));
  }

  return {
    templates,
    selectedTemplateId,
    template,
    session,
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
    exerciseHistoryByName,
    loadingExerciseHistoryByName,
    today,
    isWorkoutComplete: exercises.length > 0 && exercises.every(isExerciseResolved),
    setSelectedTemplateId,
    setOpenExerciseId,
    startSession: handleStartSession,
    endSession: handleEndSession,
    addExercise: handleAddExercise,
    removeExercise: handleRemoveExercise,
    updateExerciseStatus: handleUpdateExerciseStatus,
    saveSet: handleSaveSet,
    addSessionExerciseToTemplate: handleAddExerciseToTemplate,
    loadExerciseHistory: handleLoadExerciseHistory,
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
  const currentNames = new Set(currentExercises.map((exercise) => normalizeExerciseName(exercise.exercise_name)));
  const suggestions = [];
  const seenNames = new Set(currentNames);

  for (const exercise of templateExercises) {
    if (exercise.is_active === false) {
      continue;
    }

    const normalizedName = normalizeExerciseName(exercise.exercise_name);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    suggestions.push({
      exercise_name: exercise.exercise_name,
      muscle_group: exercise.muscle_group || '',
      source: 'template',
    });
  }

  for (const exercise of recentExercises) {
    const normalizedName = normalizeExerciseName(exercise.exercise_name);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    suggestions.push({
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
    const normalizedName = normalizeExerciseName(exercise.exercise_name);

    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    recentExercises.push(exercise);
  }

  return recentExercises.slice(0, 12);
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

function normalizeExerciseName(value) {
  return String(value || '').trim().toLowerCase();
}

function buildEmptyPrefillSets(targetSets) {
  return Array.from({ length: targetSets }, (_, index) => ({
    set_number: index + 1,
    weight: null,
    reps: null,
    rir: null,
  }));
}
