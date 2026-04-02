import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  deleteGymSessionExerciseHistory,
  deleteGymSessionHistory,
  duplicateGymTemplate,
  getGymExerciseHistory,
  getGymExerciseProgress,
  getGymSessionDetail,
  getGymSessions,
  getGymTemplates,
  renameGymExercise,
  reorderGymTemplate,
  toggleGymTemplateExercise,
  updateGymTemplateName,
  updateGymTemplateSet,
} from '../api/gymApi';

export function useGymDashboard() {
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionDetail, setSessionDetail] = useState(null);
  const [pageError, setPageError] = useState('');
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingSessionDetail, setIsLoadingSessionDetail] = useState(false);
  const [isSavingTemplateName, setIsSavingTemplateName] = useState(false);
  const [isDuplicatingTemplate, setIsDuplicatingTemplate] = useState(false);
  const [pendingExerciseActionId, setPendingExerciseActionId] = useState(null);
  const [pendingTemplateSetId, setPendingTemplateSetId] = useState(null);
  const [pendingRenameExerciseId, setPendingRenameExerciseId] = useState(null);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState(null);
  const [pendingDeleteSessionExerciseId, setPendingDeleteSessionExerciseId] = useState(null);
  const [exerciseInsightById, setExerciseInsightById] = useState({});
  const [loadingExerciseInsightById, setLoadingExerciseInsightById] = useState({});
  const [attemptedExerciseInsightById, setAttemptedExerciseInsightById] = useState({});
  const [exerciseInsightErrorById, setExerciseInsightErrorById] = useState({});

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === String(selectedTemplateId)) || null,
    [selectedTemplateId, templates],
  );

  useEffect(() => {
    void reloadDashboard();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSessionDetail() {
      if (!selectedSessionId) {
        setSessionDetail(null);
        return;
      }

      setIsLoadingSessionDetail(true);
      setPageError('');

      try {
        const detail = await getGymSessionDetail(selectedSessionId);

        if (isMounted) {
          setSessionDetail(detail);
          setExerciseInsightById({});
          setLoadingExerciseInsightById({});
          setAttemptedExerciseInsightById({});
          setExerciseInsightErrorById({});
        }
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load session detail');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessionDetail(false);
        }
      }
    }

    void loadSessionDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  async function reloadDashboard() {
    setIsLoadingDashboard(true);
    setPageError('');

    try {
      const [templateList, sessionList] = await Promise.all([
        getGymTemplates(),
        getGymSessions(),
      ]);

      setTemplates(templateList);
      setSessions(sessionList);

      startTransition(() => {
        setSelectedTemplateId((current) =>
          pickStableSelection(current, templateList, (template) => String(template.id)),
        );
        setSelectedSessionId((current) =>
          pickExistingSelection(current, sessionList, (session) => String(session.id)),
        );
      });
    } catch (error) {
      setPageError(error.message || 'Failed to load dashboard');
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function renameTemplate(name) {
    if (!selectedTemplate || !name.trim()) {
      return;
    }

    setIsSavingTemplateName(true);
    setPageError('');

    try {
      const updatedTemplate = await updateGymTemplateName(selectedTemplate.id, name.trim());

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === updatedTemplate.id
            ? {
                ...template,
                name: updatedTemplate.name,
              }
            : template,
        ),
      );
    } catch (error) {
      setPageError(error.message || 'Failed to rename template');
    } finally {
      setIsSavingTemplateName(false);
    }
  }

  async function renameExercise(exerciseId, payload) {
    setPendingRenameExerciseId(exerciseId);
    setPageError('');

    try {
      const updatedExercise = await renameGymExercise(exerciseId, payload);

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) => ({
          ...template,
          exercises: template.exercises.map((exercise) =>
            exercise.exercise_id === updatedExercise.id
              ? {
                  ...exercise,
                  exercise_name: updatedExercise.name,
                  muscle_group: updatedExercise.muscle_group || exercise.muscle_group,
                  alternates: exercise.alternates?.map((alternate) =>
                    alternate.exercise_id === updatedExercise.id
                      ? {
                          ...alternate,
                          exercise_name: updatedExercise.name,
                          muscle_group: updatedExercise.muscle_group || alternate.muscle_group,
                        }
                      : alternate,
                  ) || [],
                }
              : {
                  ...exercise,
                  alternates: exercise.alternates?.map((alternate) =>
                    alternate.exercise_id === updatedExercise.id
                      ? {
                          ...alternate,
                          exercise_name: updatedExercise.name,
                          muscle_group: updatedExercise.muscle_group || alternate.muscle_group,
                        }
                      : alternate,
                  ) || [],
                },
          ),
        })),
      );

      setSessionDetail((currentDetail) => {
        if (!currentDetail) {
          return currentDetail;
        }

        return {
          ...currentDetail,
          exercises: currentDetail.exercises.map((exercise) => ({
            ...exercise,
            exercise_name: exercise.effective_exercise_id === updatedExercise.id
              ? updatedExercise.name
              : exercise.exercise_name,
            original_exercise_name: exercise.exercise_id === updatedExercise.id
              ? updatedExercise.name
              : exercise.original_exercise_name,
            sets: exercise.sets.map((set) =>
              set.logged_exercise_id === updatedExercise.id
                ? {
                    ...set,
                    logged_exercise_name: updatedExercise.name,
                  }
                : set,
            ),
          })),
        };
      });
    } catch (error) {
      setPageError(error.message || 'Failed to rename exercise');
    } finally {
      setPendingRenameExerciseId(null);
    }
  }

  async function toggleExercise(templateExerciseId) {
    setPendingExerciseActionId(templateExerciseId);
    setPageError('');

    try {
      const updatedExercise = await toggleGymTemplateExercise(templateExerciseId);

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === updatedExercise.template_id
            ? {
                ...template,
                exercises: template.exercises.map((exercise) =>
                  exercise.template_exercise_id === updatedExercise.id
                    ? {
                        ...exercise,
                        is_active: updatedExercise.is_active,
                      }
                    : exercise,
                ),
              }
            : template,
        ),
      );
    } catch (error) {
      setPageError(error.message || 'Failed to update exercise visibility');
    } finally {
      setPendingExerciseActionId(null);
    }
  }

  async function moveExercise(templateExerciseId, direction) {
    if (!selectedTemplate) {
      return;
    }

    const currentIndex = selectedTemplate.exercises.findIndex(
      (exercise) => exercise.template_exercise_id === templateExerciseId,
    );

    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= selectedTemplate.exercises.length) {
      return;
    }

    const nextExercises = [...selectedTemplate.exercises];
    [nextExercises[currentIndex], nextExercises[nextIndex]] = [nextExercises[nextIndex], nextExercises[currentIndex]];

    const reorderPayload = nextExercises.map((exercise, index) => ({
      id: exercise.template_exercise_id,
      order_index: index + 1,
    }));

    setPendingExerciseActionId(templateExerciseId);
    setPageError('');

    try {
      const updatedTemplate = await reorderGymTemplate(selectedTemplate.id, reorderPayload);
      replaceTemplate(updatedTemplate);
    } catch (error) {
      setPageError(error.message || 'Failed to reorder exercises');
    } finally {
      setPendingExerciseActionId(null);
    }
  }

  async function saveTemplateSet(templateSetId, payload) {
    setPendingTemplateSetId(templateSetId);
    setPageError('');

    try {
      const updatedSet = await updateGymTemplateSet(templateSetId, payload);

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) => ({
          ...template,
          exercises: template.exercises.map((exercise) =>
            exercise.template_set_id === updatedSet.id
              ? {
                  ...exercise,
                  target_sets: Number(updatedSet.target_sets),
                  rep_min: updatedSet.rep_min === null ? null : Number(updatedSet.rep_min),
                  rep_max: updatedSet.rep_max === null ? null : Number(updatedSet.rep_max),
                }
              : exercise,
          ),
        })),
      );
    } catch (error) {
      setPageError(error.message || 'Failed to update template targets');
    } finally {
      setPendingTemplateSetId(null);
    }
  }

  async function duplicateTemplateRecord() {
    if (!selectedTemplate) {
      return;
    }

    setIsDuplicatingTemplate(true);
    setPageError('');

    try {
      const duplicatedTemplate = await duplicateGymTemplate(selectedTemplate.id);

      setTemplates((currentTemplates) => {
        const nextTemplates = [...currentTemplates, duplicatedTemplate];
        nextTemplates.sort(compareTemplates);
        return nextTemplates;
      });
      setSelectedTemplateId(String(duplicatedTemplate.id));
    } catch (error) {
      setPageError(error.message || 'Failed to duplicate template');
    } finally {
      setIsDuplicatingTemplate(false);
    }
  }

  async function deleteSession(sessionId) {
    setPendingDeleteSessionId(sessionId);
    setPageError('');

    try {
      await deleteGymSessionHistory(sessionId);

      setSessions((currentSessions) => currentSessions.filter((session) => session.id !== Number(sessionId)));
      setSelectedSessionId((currentSelectedId) =>
        String(currentSelectedId) === String(sessionId) ? '' : currentSelectedId,
      );
      setSessionDetail((currentDetail) =>
        currentDetail?.id === Number(sessionId) ? null : currentDetail,
      );
    } catch (error) {
      setPageError(error.message || 'Failed to delete session');
      throw error;
    } finally {
      setPendingDeleteSessionId(null);
    }
  }

  async function deleteSessionExercise(sessionExerciseId) {
    setPendingDeleteSessionExerciseId(sessionExerciseId);
    setPageError('');

    try {
      await deleteGymSessionExerciseHistory(sessionExerciseId);
      let nextSessionSummary = null;

      setSessionDetail((currentDetail) => {
        if (!currentDetail) {
          return currentDetail;
        }

        const exercises = currentDetail.exercises.filter(
          (exercise) => exercise.session_exercise_id !== Number(sessionExerciseId),
        );
        const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
        const totalVolume = exercises.reduce(
          (total, exercise) =>
            total + exercise.sets.reduce(
              (setTotal, set) => setTotal + (Number(set.weight || 0) * Number(set.reps || 0)),
              0,
            ),
          0,
        );
        nextSessionSummary = {
          exercise_count: exercises.length,
          set_count: setCount,
          total_volume: totalVolume,
          has_logged_sets: setCount > 0,
        };

        return {
          ...currentDetail,
          exercises,
          exercise_count: exercises.length,
          set_count: setCount,
          total_volume: totalVolume,
          has_logged_sets: setCount > 0,
        };
      });
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === Number(selectedSessionId)
            ? {
                ...session,
                ...(nextSessionSummary || {}),
              }
            : session,
        ),
      );
    } catch (error) {
      setPageError(error.message || 'Failed to delete exercise');
      throw error;
    } finally {
      setPendingDeleteSessionExerciseId(null);
    }
  }

  async function loadExerciseInsight(exercise) {
    const exerciseId = Number(exercise?.effective_exercise_id || 0);
    const insightKey = getExerciseInsightKey(exercise, sessionDetail?.template_id);

    if (!exerciseId || !insightKey || attemptedExerciseInsightById[insightKey] || loadingExerciseInsightById[insightKey]) {
      return;
    }

    setAttemptedExerciseInsightById((currentState) => ({
      ...currentState,
      [insightKey]: true,
    }));
    setLoadingExerciseInsightById((currentState) => ({
      ...currentState,
      [insightKey]: true,
    }));

    try {
      const templateId = getExerciseTemplateScopeId(exercise, sessionDetail?.template_id);
      const [history, progress] = await Promise.all([
        getGymExerciseHistory(exerciseId, { templateId, limit: 3 }),
        getGymExerciseProgress(exerciseId, { templateId, limit: 3 }),
      ]);

      setExerciseInsightById((currentState) => ({
        ...currentState,
        [insightKey]: {
          history,
          progress,
        },
      }));
      setExerciseInsightErrorById((currentState) => ({
        ...currentState,
        [insightKey]: '',
      }));
    } catch (error) {
      setExerciseInsightById((currentState) => ({
        ...currentState,
        [insightKey]: {
          history: [],
          progress: [],
        },
      }));
      setExerciseInsightErrorById((currentState) => ({
        ...currentState,
        [insightKey]: error.message || 'Unable to load exercise insight',
      }));
    } finally {
      setLoadingExerciseInsightById((currentState) => ({
        ...currentState,
        [insightKey]: false,
      }));
    }
  }

  function replaceTemplate(nextTemplate) {
    setTemplates((currentTemplates) =>
      currentTemplates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template)),
    );
  }

  return {
    templates,
    sessions,
    selectedTemplateId,
    selectedSessionId,
    selectedTemplate,
    sessionDetail,
    pageError,
    isLoadingDashboard,
    isLoadingSessionDetail,
    isSavingTemplateName,
    isDuplicatingTemplate,
    pendingExerciseActionId,
    pendingTemplateSetId,
    pendingRenameExerciseId,
    pendingDeleteSessionId,
    pendingDeleteSessionExerciseId,
    exerciseInsightById,
    loadingExerciseInsightById,
    exerciseInsightErrorById,
    setSelectedTemplateId,
    setSelectedSessionId,
    renameTemplate,
    renameExercise,
    toggleExercise,
    moveExercise,
    saveTemplateSet,
    duplicateTemplate: duplicateTemplateRecord,
    deleteSession,
    deleteSessionExercise,
    loadExerciseInsight,
  };
}

function pickStableSelection(currentValue, items, getKey) {
  if (currentValue && items.some((item) => getKey(item) === String(currentValue))) {
    return currentValue;
  }

  return items[0] ? getKey(items[0]) : '';
}

function pickExistingSelection(currentValue, items, getKey) {
  if (currentValue && items.some((item) => getKey(item) === String(currentValue))) {
    return currentValue;
  }

  return '';
}

function compareTemplates(left, right) {
  const leftOrder = left.day_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.day_order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(left.name).localeCompare(String(right.name));
}

function getExerciseTemplateScopeId(exercise, templateId) {
  if (!exercise?.template_exercise_id || !templateId) {
    return undefined;
  }

  return Number(templateId);
}

function getExerciseInsightKey(exercise, templateId) {
  const exerciseId = Number(exercise?.effective_exercise_id || 0);

  if (!exerciseId) {
    return '';
  }

  const templateScopeId = getExerciseTemplateScopeId(exercise, templateId);
  return `${exerciseId}:${templateScopeId || 'all'}`;
}
