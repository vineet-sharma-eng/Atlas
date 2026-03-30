import { useEffect, useState } from 'react';
import {
  addExerciseToTemplate,
  addGymExercise,
  createGymSet,
  deleteGymExercise,
  getGymSessionInit,
  getGymTemplates,
  skipGymExercise,
  startGymSession,
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

  const today = new Date().toISOString().slice(0, 10);
  const availableMuscleGroups = Array.from(
    new Set(
      exercises
        .map((exercise) => exercise.muscle_group)
        .filter(Boolean)
        .concat(DEFAULT_MUSCLE_GROUPS),
    ),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      setIsLoadingTemplates(true);
      setPageError('');

      try {
        const templateList = await getGymTemplates();

        if (!isMounted) {
          return;
        }

        setTemplates(templateList);

        if (templateList.length > 0) {
          const autoSelectedTemplate = findTemplateForToday(templateList) || templateList[0];
          setSelectedTemplateId(String(autoSelectedTemplate.id));
        }
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load templates');
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false);
        }
      }
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
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
      setTemplate(initData.template);
      setSession(initData.current_session);
      setExercises(initData.exercises);
      setOpenExerciseId(findNextOpenExerciseId(initData.exercises));
    } catch (error) {
      setPageError(error.message || 'Failed to load workout session');
    } finally {
      setIsLoadingSessionInit(false);
    }
  }

  async function handleStartSession() {
    if (!selectedTemplateId || isStartingSession) {
      return;
    }

    setIsStartingSession(true);
    setPageError('');

    try {
      await startGymSession({
        templateId: Number(selectedTemplateId),
        date: today,
      });

      await refreshSessionInit(selectedTemplateId);
    } catch (error) {
      setPageError(error.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  }

  async function handleAddExercise({ exerciseName, muscleGroup }) {
    if (!session || isAddingExercise) {
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
            is_skipped: false,
            source: 'session',
            can_add_to_template: true,
            sets: [],
            prefill_sets: buildEmptyPrefillSets(3),
          },
        ];

        setOpenExerciseId(createdExercise.session_exercise_id);
        return nextExercises;
      });
    } catch (error) {
      setPageError(error.message || 'Failed to add exercise');
    } finally {
      setIsAddingExercise(false);
    }
  }

  async function handleRemoveExercise(sessionExerciseId) {
    await deleteGymExercise(sessionExerciseId);

    setExercises((currentExercises) => {
      const nextExercises = currentExercises.filter(
        (exercise) => exercise.session_exercise_id !== sessionExerciseId,
      );
      setOpenExerciseId(findNextOpenExerciseId(nextExercises));
      return nextExercises;
    });
  }

  async function handleSkipExercise(sessionExerciseId, skipped) {
    await skipGymExercise(sessionExerciseId, skipped);

    setExercises((currentExercises) => {
      const nextExercises = currentExercises.map((exercise) =>
        exercise.session_exercise_id === sessionExerciseId
          ? {
              ...exercise,
              is_skipped: skipped,
            }
          : exercise,
      );

      if (skipped) {
        setOpenExerciseId(findNextOpenExerciseId(nextExercises, sessionExerciseId));
      }

      return nextExercises;
    });
  }

  async function handleSaveSet(sessionExerciseId, rowPayload) {
    const createdSet = await createGymSet({
      exerciseId: sessionExerciseId,
      setNumber: rowPayload.setNumber,
      weight: Number(rowPayload.weight),
      reps: rowPayload.reps === '' ? null : Number(rowPayload.reps),
      rir: rowPayload.rir === '' ? null : Number(rowPayload.rir),
    });

    setExercises((currentExercises) => {
      const nextExercises = currentExercises.map((exercise) =>
        exercise.session_exercise_id === sessionExerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets.filter((set) => set.set_number !== createdSet.set_number), createdSet]
                .sort((left, right) => left.set_number - right.set_number),
            }
          : exercise,
      );

      const targetExercise = nextExercises.find(
        (exercise) => exercise.session_exercise_id === sessionExerciseId,
      );

      if (targetExercise && isExerciseComplete(targetExercise)) {
        setOpenExerciseId(findNextOpenExerciseId(nextExercises, sessionExerciseId));
      }

      return nextExercises;
    });

    return createdSet;
  }

  async function handleAddExerciseToTemplate(exercise) {
    if (!template || !exercise.can_add_to_template) {
      return;
    }

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
    availableMuscleGroups,
    today,
    isWorkoutComplete: exercises.length > 0 && exercises.every(isExerciseComplete),
    setSelectedTemplateId,
    setOpenExerciseId,
    startSession: handleStartSession,
    addExercise: handleAddExercise,
    removeExercise: handleRemoveExercise,
    skipExercise: handleSkipExercise,
    saveSet: handleSaveSet,
    addSessionExerciseToTemplate: handleAddExerciseToTemplate,
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
  const nextExercise = afterCurrent.find((exercise) => !isExerciseComplete(exercise));

  if (nextExercise) {
    return nextExercise.session_exercise_id || nextExercise.template_exercise_id;
  }

  const firstIncomplete = exercises.find((exercise) => !isExerciseComplete(exercise));
  return firstIncomplete
    ? firstIncomplete.session_exercise_id || firstIncomplete.template_exercise_id
    : null;
}

function isExerciseComplete(exercise) {
  if (exercise.is_skipped) {
    return true;
  }

  return exercise.sets.length >= exercise.target_sets && exercise.target_sets > 0;
}

function buildEmptyPrefillSets(targetSets) {
  return Array.from({ length: targetSets }, (_, index) => ({
    set_number: index + 1,
    weight: null,
    reps: null,
    rir: null,
  }));
}
