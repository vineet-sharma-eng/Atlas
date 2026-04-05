const {
  addExerciseToTemplate,
  createGymExercise,
  createOrResumeSession,
  createTemplateExerciseAlternate,
  deleteGymExercise,
  deleteGymSession,
  deleteLoggedSessionExercise,
  duplicateTemplate,
  endGymSession,
  getActiveSessionState,
  getGymAnalysisData,
  getGymHistory,
  getExerciseHistory,
  getExerciseProgress,
  getGymSessionDetail,
  getSessionInit,
  getTemplateExerciseAlternates,
  listExerciseCatalog,
  listGymSessions,
  listRecentExercises,
  listWorkoutTemplates,
  renameExercise,
  reorderTemplateExercises,
  saveGymSet,
  toggleTemplateExercise,
  updateGymExerciseStatus,
  updateSessionExerciseOverride,
  updateTemplateName,
  updateTemplateSet,
} = require('../../db/gym');

async function getAnalysis(req, res, next) {
  try {
    const days = req.query.days === undefined
      ? 14
      : parseBoundedInteger(req.query.days, 'days', { min: 7, max: 14 });
    const analysis = await getGymAnalysisData({
      days,
      timeZone: getUserTimeZone(req),
    });

    return res.status(200).json({
      summary: buildGymAnalysisSummary(analysis, days),
      data: {
        topExercises: analysis.topExercises,
        recentWorkouts: analysis.recentWorkouts,
        progressIndicators: analysis.progressIndicators,
      },
      meta: {
        periodDays: days,
        workoutCount: analysis.workoutCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const entries = await getGymHistory(20);

    return res.status(200).json({
      summary: entries.length === 0
        ? 'No gym history found yet.'
        : `Returned ${entries.length} recent gym log entries.`,
      data: {
        entries,
      },
      meta: {
        count: entries.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function listTemplates(req, res, next) {
  try {
    return res.status(200).json(await listWorkoutTemplates());
  } catch (error) {
    return next(error);
  }
}

async function getExerciseCatalogHandler(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    const limit = req.query.limit ? parsePositiveInteger(req.query.limit, 'limit') : 50;
    return res.status(200).json(await listExerciseCatalog({ search, limit }));
  } catch (error) {
    return next(error);
  }
}

async function listRecentExercisesHandler(req, res, next) {
  try {
    const limit = req.query.limit ? parsePositiveInteger(req.query.limit, 'limit') : 12;
    return res.status(200).json(await listRecentExercises(limit));
  } catch (error) {
    return next(error);
  }
}

async function getActiveSession(req, res, next) {
  try {
    return res.status(200).json(await getActiveSessionState({ timeZone: getUserTimeZone(req) }));
  } catch (error) {
    return next(error);
  }
}

async function initSession(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.template_id, 'template_id');
    const initData = await getSessionInit({ templateId, timeZone: getUserTimeZone(req) });

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
    const sessionState = await createOrResumeSession({ templateId, timeZone: getUserTimeZone(req) });

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

async function deleteSessionHandler(req, res, next) {
  try {
    const sessionId = parsePositiveInteger(req.params.id, 'session id');
    const deletedSession = await deleteGymSession(sessionId);

    if (!deletedSession) {
      return res.status(404).json({ error: 'Gym session not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function deleteSessionExerciseHandler(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'session exercise id');
    const deletedExercise = await deleteLoggedSessionExercise(exerciseId);

    if (!deletedExercise) {
      return res.status(404).json({ error: 'Gym exercise not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function updateExerciseStatus(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const status = String(req.body.status || '').trim();

    if (!['pending', 'completed', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, completed, or skipped' });
    }

    return res.status(200).json(await updateGymExerciseStatus(exerciseId, status));
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

    return res.status(201).json(await saveGymSet({
      exerciseId,
      setNumber,
      weight,
      reps,
      rir,
    }));
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

    return res.status(201).json(await addExerciseToTemplate({
      templateId,
      exerciseName,
      muscleGroup,
    }));
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

async function renameExerciseHandler(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const name = String(req.body.name || '').trim();
    const muscleGroup = req.body.muscle_group === undefined ? undefined : String(req.body.muscle_group || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const exercise = await renameExercise(exerciseId, { name, muscleGroup });

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    return res.status(200).json(exercise);
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
    return res.status(200).json(await listGymSessions());
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
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const beforeDate = req.query.before_date ? parseDate(req.query.before_date) : null;
    const templateId = req.query.template_id ? parsePositiveInteger(req.query.template_id, 'template_id') : null;
    const limit = req.query.limit ? parsePositiveInteger(req.query.limit, 'limit') : 3;
    return res.status(200).json(await getExerciseHistory(exerciseId, {
      beforeDate,
      limit,
      templateId,
      timeZone: getUserTimeZone(req),
    }));
  } catch (error) {
    return next(error);
  }
}

async function getExerciseProgressHandler(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const beforeDate = req.query.before_date ? parseDate(req.query.before_date) : null;
    const templateId = req.query.template_id ? parsePositiveInteger(req.query.template_id, 'template_id') : null;
    const limit = req.query.limit ? parsePositiveInteger(req.query.limit, 'limit') : 3;
    return res.status(200).json(await getExerciseProgress(exerciseId, {
      beforeDate,
      limit,
      templateId,
      timeZone: getUserTimeZone(req),
    }));
  } catch (error) {
    return next(error);
  }
}

async function getTemplateExerciseAlternatesHandler(req, res, next) {
  try {
    const templateExerciseId = parsePositiveInteger(req.params.id, 'template exercise id');
    return res.status(200).json(await getTemplateExerciseAlternates(templateExerciseId));
  } catch (error) {
    return next(error);
  }
}

async function createTemplateExerciseAlternateHandler(req, res, next) {
  try {
    const templateExerciseId = parsePositiveInteger(req.params.id, 'template exercise id');
    const exerciseId = req.body.exercise_id ? parsePositiveInteger(req.body.exercise_id, 'exercise_id') : null;
    const name = String(req.body.name || '').trim();
    const muscleGroup = String(req.body.muscle_group || '').trim();

    if (!exerciseId && !name) {
      return res.status(400).json({ error: 'exercise_id or name is required' });
    }

    return res.status(201).json(await createTemplateExerciseAlternate(templateExerciseId, {
      exerciseId,
      name,
      muscleGroup,
    }));
  } catch (error) {
    return next(error);
  }
}

async function updateSessionExerciseOverrideHandler(req, res, next) {
  try {
    const sessionExerciseId = parsePositiveInteger(req.params.id, 'session exercise id');
    const overrideAlternateId = req.body.override_alternate_id === null || req.body.override_alternate_id === undefined
      ? null
      : parsePositiveInteger(req.body.override_alternate_id, 'override_alternate_id');
    const confirmKeepLoggedSets = req.body.confirm_keep_logged_sets === true;
    const result = await updateSessionExerciseOverride(sessionExerciseId, {
      overrideAlternateId,
      confirmKeepLoggedSets,
    });

    if (result.type === 'confirmation_required') {
      return res.status(409).json(result);
    }

    return res.status(200).json(result.exercise);
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

function parsePositiveInteger(value, fieldName) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function parseBoundedInteger(value, fieldName, { min, max }) {
  const parsed = parsePositiveInteger(value, fieldName);

  if (parsed < min || parsed > max) {
    const error = new Error(`${fieldName} must be between ${min} and ${max}`);
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

function getUserTimeZone(req) {
  const headerValue = req.get('X-User-Timezone');
  return String(headerValue || '').trim() || 'UTC';
}

function buildGymAnalysisSummary(analysis, days) {
  if (analysis.workoutCount === 0) {
    return `No workouts logged in the last ${days} days.`;
  }

  const parts = [`Logged ${analysis.workoutCount} workout${analysis.workoutCount === 1 ? '' : 's'} in the last ${days} days`];

  if (analysis.topExercises[0]) {
    parts.push(`most frequent exercise was ${analysis.topExercises[0].exercise}`);
  }

  if (analysis.progressIndicators[0]) {
    parts.push(analysis.progressIndicators[0].trend.toLowerCase());
  }

  return `${parts.join(', ')}.`;
}

module.exports = {
  getAnalysis,
  getHistory,
  listTemplates,
  getExerciseCatalogHandler,
  listRecentExercisesHandler,
  getActiveSession,
  initSession,
  startSession,
  endSession,
  addExercise,
  removeExercise,
  deleteSessionHandler,
  deleteSessionExerciseHandler,
  updateExerciseStatus,
  addSet,
  addTemplateExercise,
  renameTemplate,
  renameExerciseHandler,
  toggleTemplateExerciseVisibility,
  reorderTemplate,
  listSessions,
  getSessionDetail,
  updateTemplateSetHandler,
  getExerciseHistoryHandler,
  getExerciseProgressHandler,
  getTemplateExerciseAlternatesHandler,
  createTemplateExerciseAlternateHandler,
  updateSessionExerciseOverrideHandler,
  duplicateTemplateHandler,
};
