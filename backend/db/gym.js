const pool = require('./pool');

let schemaReadyPromise;

async function ensureGymSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureGymSchemaInternal();
  }

  return schemaReadyPromise;
}

async function ensureGymSchemaInternal() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      day TEXT,
      day_order INTEGER
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS template_exercises (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT,
      order_index INTEGER NOT NULL DEFAULT 1
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS template_sets (
      template_exercise_id INTEGER PRIMARY KEY REFERENCES template_exercises(id) ON DELETE CASCADE,
      target_sets INTEGER NOT NULL DEFAULT 1,
      rep_min INTEGER,
      rep_max INTEGER,
      notes TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gym_sessions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      day_label TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gym_exercises (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT,
      order_index INTEGER NOT NULL DEFAULT 1,
      is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gym_sets (
      id SERIAL PRIMARY KEY,
      exercise_id INTEGER NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
      reps INTEGER,
      rir INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE workout_templates
    ADD COLUMN IF NOT EXISTS day_order INTEGER;
  `);

  await pool.query(`
    ALTER TABLE template_exercises
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 1;
  `);

  await pool.query(`
    ALTER TABLE gym_sessions
    ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE gym_exercises
    ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

async function listWorkoutTemplates() {
  await ensureGymSchema();

  const result = await pool.query(`
    SELECT id, name, day, day_order
    FROM workout_templates
    ORDER BY day_order ASC NULLS LAST, name ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    day: row.day,
    day_order: row.day_order === null ? null : Number(row.day_order),
  }));
}

async function getTemplateById(templateId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, name, day, day_order
      FROM workout_templates
      WHERE id = $1
    `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function getTemplateExercises(templateId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT
        te.id AS template_exercise_id,
        te.exercise_name,
        te.muscle_group,
        te.order_index,
        COALESCE(ts.target_sets, 1)::int AS target_sets,
        ts.rep_min::int AS rep_min,
        ts.rep_max::int AS rep_max,
        ts.notes
      FROM template_exercises te
      LEFT JOIN template_sets ts ON ts.template_exercise_id = te.id
      WHERE te.template_id = $1
      ORDER BY te.order_index ASC, te.id ASC
    `,
    [templateId]
  );

  return result.rows.map(mapTemplateExerciseRow);
}

async function getSessionByTemplateAndDate(templateId, date) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, date, day_label, template_id
      FROM gym_sessions
      WHERE template_id = $1 AND date = $2
      ORDER BY id DESC
      LIMIT 1
    `,
    [templateId, date]
  );

  return result.rows[0] || null;
}

async function getLatestPreviousSession(templateId, date) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, date, day_label, template_id
      FROM gym_sessions
      WHERE template_id = $1 AND date < $2
      ORDER BY date DESC, id DESC
      LIMIT 1
    `,
    [templateId, date]
  );

  return result.rows[0] || null;
}

async function createOrResumeSession({ templateId, date }) {
  await ensureGymSchema();

  const template = await getTemplateById(templateId);

  if (!template) {
    return null;
  }

  const existingSession = await getSessionByTemplateAndDate(templateId, date);

  if (existingSession) {
    return {
      session: existingSession,
      resumed: true,
    };
  }

  const sessionResult = await pool.query(
    `
      INSERT INTO gym_sessions (date, day_label, template_id)
      VALUES ($1, $2, $3)
      RETURNING id, date, day_label, template_id
    `,
    [date, template.name, templateId]
  );

  const session = sessionResult.rows[0];

  await pool.query(
    `
      INSERT INTO gym_exercises (session_id, exercise_name, muscle_group, order_index)
      SELECT $1, exercise_name, muscle_group, order_index
      FROM template_exercises
      WHERE template_id = $2
      ORDER BY order_index ASC, id ASC
    `,
    [session.id, templateId]
  );

  return {
    session,
    resumed: false,
  };
}

async function getSessionExercises(sessionId) {
  await ensureGymSchema();

  const exercisesResult = await pool.query(
    `
      SELECT
        id,
        session_id,
        exercise_name,
        muscle_group,
        order_index,
        is_skipped
      FROM gym_exercises
      WHERE session_id = $1
      ORDER BY order_index ASC, id ASC
    `,
    [sessionId]
  );

  const setsResult = await pool.query(
    `
      SELECT id, exercise_id, set_number, weight, reps, rir
      FROM gym_sets
      WHERE exercise_id = ANY(
        SELECT id FROM gym_exercises WHERE session_id = $1
      )
      ORDER BY exercise_id ASC, set_number ASC, id ASC
    `,
    [sessionId]
  );

  const setsByExerciseId = new Map();

  for (const row of setsResult.rows) {
    const current = setsByExerciseId.get(row.exercise_id) || [];
    current.push({
      id: row.id,
      exercise_id: row.exercise_id,
      set_number: Number(row.set_number),
      weight: row.weight === null ? null : Number(row.weight),
      reps: row.reps === null ? null : Number(row.reps),
      rir: row.rir === null ? null : Number(row.rir),
    });
    setsByExerciseId.set(row.exercise_id, current);
  }

  return exercisesResult.rows.map((row) => ({
    session_exercise_id: row.id,
    session_id: row.session_id,
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    is_skipped: row.is_skipped,
    sets: setsByExerciseId.get(row.id) || [],
  }));
}

async function getSessionInit({ templateId, date }) {
  await ensureGymSchema();

  const [template, templateExercises, currentSession, previousSession] = await Promise.all([
    getTemplateById(templateId),
    getTemplateExercises(templateId),
    getSessionByTemplateAndDate(templateId, date),
    getLatestPreviousSession(templateId, date),
  ]);

  if (!template) {
    return null;
  }

  const [currentSessionExercises, previousSessionExercises] = await Promise.all([
    currentSession ? getSessionExercises(currentSession.id) : Promise.resolve([]),
    previousSession ? getSessionExercises(previousSession.id) : Promise.resolve([]),
  ]);

  const exercises = buildSessionInitExercises({
    templateExercises,
    currentSessionExercises,
    previousSessionExercises,
  });

  return {
    template,
    current_session: currentSession,
    last_session: previousSession,
    exercises,
  };
}

function buildSessionInitExercises({
  templateExercises,
  currentSessionExercises,
  previousSessionExercises,
}) {
  if (currentSessionExercises.length > 0) {
    return currentSessionExercises.map((sessionExercise) => {
      const templateExercise = findMatchingTemplateExercise(templateExercises, sessionExercise);
      const previousExercise = findMatchingSessionExercise(previousSessionExercises, sessionExercise);

      return buildExercisePayload({
        templateExercise,
        sessionExercise,
        previousExercise,
      });
    });
  }

  return templateExercises.map((templateExercise) => {
    const previousExercise = findMatchingSessionExercise(previousSessionExercises, templateExercise);

    return buildExercisePayload({
      templateExercise,
      sessionExercise: null,
      previousExercise,
    });
  });
}

function buildExercisePayload({ templateExercise, sessionExercise, previousExercise }) {
  const targetSets = templateExercise?.target_sets || previousExercise?.sets.length || 1;

  return {
    template_exercise_id: templateExercise?.template_exercise_id || null,
    session_exercise_id: sessionExercise?.session_exercise_id || null,
    exercise_name: sessionExercise?.exercise_name || templateExercise?.exercise_name || '',
    muscle_group: sessionExercise?.muscle_group || templateExercise?.muscle_group || '',
    order_index: sessionExercise?.order_index || templateExercise?.order_index || 1,
    target_sets: targetSets,
    rep_min: templateExercise?.rep_min ?? null,
    rep_max: templateExercise?.rep_max ?? null,
    notes: templateExercise?.notes || '',
    is_skipped: sessionExercise?.is_skipped || false,
    source: templateExercise ? 'template' : 'session',
    can_add_to_template: !templateExercise,
    sets: sessionExercise?.sets || [],
    prefill_sets: buildPrefillSets(targetSets, previousExercise?.sets || []),
  };
}

function buildPrefillSets(targetSets, previousSets) {
  return Array.from({ length: targetSets }, (_, index) => {
    const setNumber = index + 1;
    const matchingSet = previousSets.find((set) => set.set_number === setNumber);

    return {
      set_number: setNumber,
      weight: matchingSet?.weight ?? null,
      reps: matchingSet?.reps ?? null,
      rir: matchingSet?.rir ?? null,
    };
  });
}

function findMatchingTemplateExercise(templateExercises, exerciseLike) {
  const normalizedName = normalizeValue(exerciseLike.exercise_name);
  const normalizedMuscleGroup = normalizeValue(exerciseLike.muscle_group);

  return (
    templateExercises.find(
      (templateExercise) =>
        templateExercise.order_index === exerciseLike.order_index &&
        normalizeValue(templateExercise.exercise_name) === normalizedName,
    ) ||
    templateExercises.find(
      (templateExercise) =>
        normalizeValue(templateExercise.exercise_name) === normalizedName &&
        normalizeValue(templateExercise.muscle_group) === normalizedMuscleGroup,
    ) ||
    null
  );
}

function findMatchingSessionExercise(sessionExercises, exerciseLike) {
  const normalizedName = normalizeValue(exerciseLike.exercise_name);
  const normalizedMuscleGroup = normalizeValue(exerciseLike.muscle_group);

  return (
    sessionExercises.find(
      (sessionExercise) =>
        sessionExercise.order_index === exerciseLike.order_index &&
        normalizeValue(sessionExercise.exercise_name) === normalizedName,
    ) ||
    sessionExercises.find(
      (sessionExercise) =>
        normalizeValue(sessionExercise.exercise_name) === normalizedName &&
        normalizeValue(sessionExercise.muscle_group) === normalizedMuscleGroup,
    ) ||
    null
  );
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function mapTemplateExerciseRow(row) {
  return {
    template_exercise_id: row.template_exercise_id,
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    target_sets: Number(row.target_sets || 1),
    rep_min: row.rep_min === null ? null : Number(row.rep_min),
    rep_max: row.rep_max === null ? null : Number(row.rep_max),
    notes: row.notes || '',
  };
}

async function createGymExercise({ sessionId, exerciseName, muscleGroup }) {
  await ensureGymSchema();

  const orderResult = await pool.query(
    `
      SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
      FROM gym_exercises
      WHERE session_id = $1
    `,
    [sessionId]
  );

  const orderIndex = Number(orderResult.rows[0].next_order || 1);

  const result = await pool.query(
    `
      INSERT INTO gym_exercises (session_id, exercise_name, muscle_group, order_index)
      VALUES ($1, $2, $3, $4)
      RETURNING id, session_id, exercise_name, muscle_group, order_index, is_skipped
    `,
    [sessionId, exerciseName, muscleGroup || null, orderIndex]
  );

  return {
    session_exercise_id: result.rows[0].id,
    session_id: result.rows[0].session_id,
    exercise_name: result.rows[0].exercise_name,
    muscle_group: result.rows[0].muscle_group,
    order_index: Number(result.rows[0].order_index),
    is_skipped: result.rows[0].is_skipped,
    sets: [],
  };
}

async function deleteGymExercise(exerciseId) {
  await ensureGymSchema();

  await pool.query(
    `
      DELETE FROM gym_exercises
      WHERE id = $1
    `,
    [exerciseId]
  );
}

async function markGymExerciseSkipped(exerciseId, skipped) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE gym_exercises
      SET is_skipped = $2
      WHERE id = $1
      RETURNING id, is_skipped
    `,
    [exerciseId, skipped]
  );

  return result.rows[0] || null;
}

async function createGymSet({ exerciseId, setNumber, weight, reps, rir }) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      INSERT INTO gym_sets (exercise_id, set_number, weight, reps, rir)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, exercise_id, set_number, weight, reps, rir
    `,
    [exerciseId, setNumber, weight, reps, rir]
  );

  return {
    id: result.rows[0].id,
    exercise_id: result.rows[0].exercise_id,
    set_number: Number(result.rows[0].set_number),
    weight: result.rows[0].weight === null ? null : Number(result.rows[0].weight),
    reps: result.rows[0].reps === null ? null : Number(result.rows[0].reps),
    rir: result.rows[0].rir === null ? null : Number(result.rows[0].rir),
  };
}

async function addExerciseToTemplate({ templateId, exerciseName, muscleGroup }) {
  await ensureGymSchema();

  const orderResult = await pool.query(
    `
      SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
      FROM template_exercises
      WHERE template_id = $1
    `,
    [templateId]
  );

  const orderIndex = Number(orderResult.rows[0].next_order || 1);

  const exerciseResult = await pool.query(
    `
      INSERT INTO template_exercises (template_id, exercise_name, muscle_group, order_index)
      VALUES ($1, $2, $3, $4)
      RETURNING id, template_id, exercise_name, muscle_group, order_index
    `,
    [templateId, exerciseName, muscleGroup || null, orderIndex]
  );

  await pool.query(
    `
      INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, notes)
      SELECT $1, 3, 8, 12, NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM template_sets
        WHERE template_exercise_id = $1
      )
    `,
    [exerciseResult.rows[0].id]
  );

  return exerciseResult.rows[0];
}

module.exports = {
  ensureGymSchema,
  listWorkoutTemplates,
  createOrResumeSession,
  getSessionInit,
  createGymExercise,
  deleteGymExercise,
  markGymExerciseSkipped,
  createGymSet,
  addExerciseToTemplate,
};
