import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  duplicateGymTemplate,
  getGymExerciseHistory,
  getGymExerciseProgress,
  getGymSessionDetail,
  getGymSessions,
  getGymTemplates,
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
  const [selectedExerciseName, setSelectedExerciseName] = useState('');
  const [sessionDetail, setSessionDetail] = useState(null);
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [exerciseProgress, setExerciseProgress] = useState([]);
  const [pageError, setPageError] = useState('');
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingSessionDetail, setIsLoadingSessionDetail] = useState(false);
  const [isLoadingExerciseHistory, setIsLoadingExerciseHistory] = useState(false);
  const [isSavingTemplateName, setIsSavingTemplateName] = useState(false);
  const [isDuplicatingTemplate, setIsDuplicatingTemplate] = useState(false);
  const [pendingExerciseActionId, setPendingExerciseActionId] = useState(null);
  const [pendingTemplateSetId, setPendingTemplateSetId] = useState(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === String(selectedTemplateId)) || null,
    [selectedTemplateId, templates],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoadingDashboard(true);
      setPageError('');

      try {
        const [templateList, sessionList] = await Promise.all([
          getGymTemplates(),
          getGymSessions(),
        ]);

        if (!isMounted) {
          return;
        }

        setTemplates(templateList);
        setSessions(sessionList);

        startTransition(() => {
          setSelectedTemplateId((current) =>
            pickStableSelection(current, templateList, (template) => String(template.id)),
          );
          setSelectedSessionId((current) =>
            pickStableSelection(current, sessionList, (session) => String(session.id)),
          );
        });
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load dashboard');
        }
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
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

        if (!isMounted) {
          return;
        }

        setSessionDetail(detail);
        setSelectedExerciseName((current) => {
          if (current && detail.exercises.some((exercise) => exercise.exercise_name === current)) {
            return current;
          }

          return detail.exercises[0]?.exercise_name || '';
        });
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

    loadSessionDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadExerciseHistory() {
      if (!selectedExerciseName) {
        setExerciseHistory([]);
        setExerciseProgress([]);
        return;
      }

      setIsLoadingExerciseHistory(true);
      setPageError('');

      try {
        const [history, progress] = await Promise.all([
          getGymExerciseHistory(selectedExerciseName),
          getGymExerciseProgress(selectedExerciseName),
        ]);

        if (!isMounted) {
          return;
        }

        setExerciseHistory(history);
        setExerciseProgress(progress);
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load exercise history');
        }
      } finally {
        if (isMounted) {
          setIsLoadingExerciseHistory(false);
        }
      }
    }

    loadExerciseHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedExerciseName]);

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
    selectedExerciseName,
    selectedTemplate,
    sessionDetail,
    exerciseHistory,
    exerciseProgress,
    pageError,
    isLoadingDashboard,
    isLoadingSessionDetail,
    isLoadingExerciseHistory,
    isSavingTemplateName,
    isDuplicatingTemplate,
    pendingExerciseActionId,
    pendingTemplateSetId,
    setSelectedTemplateId,
    setSelectedSessionId,
    setSelectedExerciseName,
    renameTemplate,
    toggleExercise,
    moveExercise,
    saveTemplateSet,
    duplicateTemplate: duplicateTemplateRecord,
  };
}

function pickStableSelection(currentValue, items, getKey) {
  if (currentValue && items.some((item) => getKey(item) === String(currentValue))) {
    return currentValue;
  }

  return items[0] ? getKey(items[0]) : '';
}

function compareTemplates(left, right) {
  const leftOrder = left.day_order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.day_order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(left.name).localeCompare(String(right.name));
}
