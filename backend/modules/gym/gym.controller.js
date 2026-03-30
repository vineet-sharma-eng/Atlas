const {
  addExerciseToTemplate,
  createGymExercise,
  createGymSet,
  createOrResumeSession,
  deleteGymExercise,
  getSessionInit,
  listWorkoutTemplates,
  markGymExerciseSkipped,
} = require('../../db/gym');

async function listTemplates(req, res, next) {
  try {
    const templates = await listWorkoutTemplates();
    return res.status(200).json(templates);
  } catch (error) {
    return next(error);
  }
}

async function initSession(req, res, next) {
  try {
    const templateId = parsePositiveInteger(req.params.template_id, 'template_id');
    const date = parseDate(req.query.date);
    const initData = await getSessionInit({ templateId, date });

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

async function skipExercise(req, res, next) {
  try {
    const exerciseId = parsePositiveInteger(req.params.id, 'exercise id');
    const skipped = req.body.skipped === undefined ? true : Boolean(req.body.skipped);
    const exercise = await markGymExerciseSkipped(exerciseId, skipped);

    if (!exercise) {
      return res.status(404).json({ error: 'Gym exercise not found' });
    }

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

    const set = await createGymSet({
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
  initSession,
  startSession,
  addExercise,
  removeExercise,
  skipExercise,
  addSet,
  addTemplateExercise,
};
