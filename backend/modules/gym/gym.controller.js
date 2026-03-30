const {
  addExerciseToTemplate,
  createGymExercise,
  createOrResumeSession,
  deleteGymExercise,
  duplicateTemplate,
  endGymSession,
  getExerciseHistory,
  getExerciseProgress,
  getActiveSessionState,
  getGymSessionDetail,
  getSessionInit,
  listGymSessions,
  listWorkoutTemplates,
  reorderTemplateExercises,
  saveGymSet,
  toggleTemplateExercise,
  updateTemplateName,
  updateTemplateSet,
  updateGymExerciseStatus,
} = require('../../db/gym');

async function listTemplates(req, res, next) {
  try {
    const templates = await listWorkoutTemplates();
    return res.status(200).json(templates);
  } catch (error) {
    return next(error);
  }
}

async function getActiveSession(req, res, next) {
  try {
    const activeSession = await getActiveSessionState();
    return res.status(200).json(activeSession);
  } catch (error) {
    return next(error);
  }
}

async function initSession(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.template_id, 'template_id');
    const initData = await getSessionInit({ templateId });

    if (!initData) {
      return res.status(404).json({ error: 'Workout template not found' });
    }

    return res.status(200).json(initData);
  } catch (error) {
    return next(error);
  }
}

async function startSession(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.body.template_id, 'template_id');
    const date = parseDate(req.body.date);
    const sessionState = await createOrResumeSession({ templateId, date });

    if (!sessionState) {
      return res.status(404).json({ error: 'Workout template not found' });
    }

    return res.status(sessionState.resumed ? 200 : 201).json(sessionState);
  } catch (error) {
    return next(error);
  }
}

async function endSession(req, res, next) {
  try {
    const sessionId = parsePositiveInteger(req.body.session_id, 'session_id');
    const result = await endGymSession(sessionId);

    if (result.type === 'not_found') {
      return res.status(404).json({ error: 'Gym session not found' });
    }

    if (result.type === 'invalid_status') {
      return res.status(409).json({ error: `Cannot end session with status ${result.session.status}` });
    }

    return res.status(200).json(result.session);
  } catch (error) {
    return next(error);
  }
}

async function addExercise(req, res, next) {
  try {
    const sessionId = parsePositiveInteger(req.body.session_id, 'session_id');
    const exerciseName = String(req.body.exercise_name || '').trim();
    const muscleGroup = String(req.body.muscle_group || '').trim();

    if (!exerciseName) {
      return res.status(400).json({ error: 'exercise_name is required' });
    }

    const exercise = await createGymExercise({
      sessionId,
      exerciseName,
      muscleGroup,
    });

    return res.status(201).json(exercise);
  } catch (error) {
    return next(error);
  }
}

async function removeExercise(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    await deleteGymExercise(exerciseId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function updateExerciseStatus(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const status = String(req.body.status || '').trim();

    if (!['completed', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'status must be completed or skipped' });
    }

    const exercise = await updateGymExerciseStatus(exerciseId, status);
    return res.status(200).json(exercise);
  } catch (error) {
    return next(error);
  }
}

async function addSet(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.body.exercise_id, 'exercise_id');
    const setNumber = parsePositiveInteger(req.body.set_number, 'set_number');
    const weight = Number(req.body.weight);
    const reps = req.body.reps === null || req.body.reps === undefined ? null : Number(req.body.reps);
    const rir = parseOptionalInteger(req.body.rir, 'rir');

    if (!Number.isFinite(weight) || weight < 0) {
      return res.status(400).json({ error: 'weight must be a non-negative number' });
    }

    if (reps !== null && (!Number.isFinite(reps) || reps < 0)) {
      return res.status(400).json({ error: 'reps must be a non-negative number' });
    }

    if (rir !== null && (rir < 0 || rir > 4)) {
      return res.status(400).json({ error: 'rir must be an integer between 0 and 4' });
    }

    const set = await saveGymSet({
      exerciseId,
      setNumber,
      weight,
      reps,
      rir,
    });

    return res.status(201).json(set);
  } catch (error) {
    return next(error);
  }
}

async function addTemplateExercise(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.body.template_id, 'template_id');
    const exerciseName = String(req.body.exercise_name || '').trim();
    const muscleGroup = String(req.body.muscle_group || '').trim();

    if (!exerciseName) {
      return res.status(400).json({ error: 'exercise_name is required' });
    }

    const exercise = await addExerciseToTemplate({
      templateId,
      exerciseName,
      muscleGroup,
    });

    return res.status(201).json(exercise);
  } catch (error) {
    return next(error);
  }
}

async function renameTemplate(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.id, 'template id');
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const template = await updateTemplateName(templateId, name);

    if (!template) {
      return res.status(404).json({ error: 'Workout template not found' });
    }

    return res.status(200).json(template);
  } catch (error) {
    return next(error);
  }
}

async function toggleTemplateExerciseVisibility(req, res, next) {
  try {
    const templateExerciseId = parsePositiveInteger(req.params.id, 'template exercise id');
    const exercise = await toggleTemplateExercise(templateExerciseId);

    if (!exercise) {
      return res.status(404).json({ error: 'Template exercise not found' });
    }

    return res.status(200).json(exercise);
  } catch (error) {
    return next(error);
  }
}

async function reorderTemplate(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.id, 'template id');
    const exercises = Array.isArray(req.body.exercises) ? req.body.exercises : [];

    if (exercises.length === 0) {
      return res.status(400).json({ error: 'exercises is required' });
    }

    const normalizedExercises = exercises.map((exercise) => ({
      id: parsePositiveInteger(exercise.id, 'exercise id'),
      order_index: parsePositiveInteger(exercise.order_index, 'order_index'),
    }));
    const uniqueIds = new Set(normalizedExercises.map((exercise) => exercise.id));
    const uniqueOrderIndexes = new Set(normalizedExercises.map((exercise) => exercise.order_index));

    if (uniqueIds.size !== normalizedExercises.length || uniqueOrderIndexes.size !== normalizedExercises.length) {
      return res.status(400).json({ error: 'exercises must contain unique ids and order_index values' });
    }

    const template = await reorderTemplateExercises(templateId, normalizedExercises);

    if (!template) {
      return res.status(404).json({ error: 'Workout template not found' });
    }

    return res.status(200).json(template);
  } catch (error) {
    return next(error);
  }
}

async function listSessions(req, res, next) {
  try {
    const sessions = await listGymSessions();
    return res.status(200).json(sessions);
  } catch (error) {
    return next(error);
  }
}

async function getSessionDetail(req, res, next) {
  try {
    const sessionId = parsePositiveInteger(req.params.id, 'session id');
    const session = await getGymSessionDetail(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Gym session not found' });
    }

    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
}

async function updateTemplateSetHandler(req, res, next) {
  try {
    const templateSetId = parsePositiveInteger(req.params.id, 'template set id');
    const targetSets = parsePositiveInteger(req.body.target_sets, 'target_sets');
    const repMin = parseNullableInteger(req.body.rep_min, 'rep_min');
    const repMax = parseNullableInteger(req.body.rep_max, 'rep_max');

    if ((repMin === null) !== (repMax === null)) {
      return res.status(400).json({ error: 'rep_min and rep_max must both be null or both be integers' });
    }

    if (repMin !== null && repMax !== null && repMin > repMax) {
      return res.status(400).json({ error: 'rep_min must be less than or equal to rep_max' });
    }

    const templateSet = await updateTemplateSet(templateSetId, { targetSets, repMin, repMax });

    if (!templateSet) {
      return res.status(404).json({ error: 'Template set not found' });
    }

    return res.status(200).json(templateSet);
  } catch (error) {
    return next(error);
  }
}

async function getExerciseHistoryHandler(req, res, next) {
  try {
    const exerciseName = decodeURIComponent(String(req.params.name || '')).trim();

    if (!exerciseName) {
      return res.status(400).json({ error: 'exercise name is required' });
    }

    const history = await getExerciseHistory(exerciseName);
    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
}

async function duplicateTemplateHandler(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.id, 'template id');
    const template = await duplicateTemplate(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Workout template not found' });
    }

    return res.status(201).json(template);
  } catch (error) {
    return next(error);
  }
}

async function getExerciseProgressHandler(req, res, next) {
  try {
    const exerciseName = decodeURIComponent(String(req.params.name || '')).trim();

    if (!exerciseName) {
      return res.status(400).json({ error: 'exercise name is required' });
    }

    const progress = await getExerciseProgress(exerciseName);
    return res.status(200).json(progress);
  } catch (error) {
    return next(error);
  }
}

function parsePositiveInteger(value, fieldName) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parseOptionalInteger(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be an integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parseNullableInteger(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return parsePositiveInteger(value, fieldName);
}

function parseDate(value) {
  const candidate = String(value || '').trim();

  if (!candidate) {
    const error = new Error('date is required');
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    const error = new Error('date must be in YYYY-MM-DD format');
    error.statusCode = 400;
    throw error;
  }

  return candidate;
}

module.exports = {
  listTemplates,
  getActiveSession,
  initSession,
  startSession,
  endSession,
  addExercise,
  removeExercise,
  updateExerciseStatus,
  addSet,
  addTemplateExercise,
  renameTemplate,
  toggleTemplateExerciseVisibility,
  reorderTemplate,
  listSessions,
  getSessionDetail,
  updateTemplateSetHandler,
  getExerciseHistoryHandler,
  duplicateTemplateHandler,
  getExerciseProgressHandler,
};
