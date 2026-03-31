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
      id SERIAL PRIMARY KEY,
      template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
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
      template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gym_exercises (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT,
      order_index INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    ALTER TABLE template_exercises
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await pool.query(`
    ALTER TABLE gym_sessions
    ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE gym_sessions
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
  `);

  await pool.query(`
    ALTER TABLE gym_sessions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE gym_exercises
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
  `);

  await pool.query(`
    ALTER TABLE gym_exercises
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE gym_sets
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    WITH canonical_exercises AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY template_id, LOWER(TRIM(exercise_name))
          ORDER BY order_index ASC, id ASC
        ) AS keep_id
      FROM template_exercises
    )
    UPDATE template_sets AS ts
    SET template_exercise_id = canonical_exercises.keep_id
    FROM canonical_exercises
    WHERE ts.template_exercise_id = canonical_exercises.id
      AND canonical_exercises.id <> canonical_exercises.keep_id;
  `);

  await pool.query(`
    WITH ranked_exercises AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY template_id, LOWER(TRIM(exercise_name))
          ORDER BY order_index ASC, id ASC
        ) AS row_number
      FROM template_exercises
    )
    DELETE FROM template_exercises
    WHERE id IN (
      SELECT id
      FROM ranked_exercises
      WHERE row_number > 1
    );
  `);

  await pool.query(`
    WITH ranked_sets AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY template_exercise_id
          ORDER BY id ASC
        ) AS row_number
      FROM template_sets
    )
    DELETE FROM template_sets
    WHERE id IN (
      SELECT id
      FROM ranked_sets
      WHERE row_number > 1
    );
  `);

  await pool.query(`
    WITH ranked_gym_sets AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY exercise_id, set_number
          ORDER BY updated_at DESC NULLS LAST, id DESC
        ) AS row_number
      FROM gym_sets
    )
    DELETE FROM gym_sets
    WHERE id IN (
      SELECT id
      FROM ranked_gym_sets
      WHERE row_number > 1
    );
  `);

  await pool.query(`
    WITH normalized_order AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY template_id
          ORDER BY order_index ASC, id ASC
        ) AS next_order
      FROM template_exercises
    )
    UPDATE template_exercises AS te
    SET order_index = normalized_order.next_order
    FROM normalized_order
    WHERE te.id = normalized_order.id
      AND te.order_index <> normalized_order.next_order;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_template_exercise_unique
    ON template_exercises (template_id, exercise_name);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_template_exercise_order
    ON template_exercises (template_id, order_index);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_template_sets_unique
    ON template_sets (template_exercise_id);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_sets_exercise_number
    ON gym_sets (exercise_id, set_number);
  `);
}

async function listWorkoutTemplates() {
  await ensureGymSchema();

  const [templatesResult, exerciseRows] = await Promise.all([
    pool.query(`
      SELECT id, name, day, day_order
      FROM workout_templates
      ORDER BY day_order ASC NULLS LAST, name ASC
    `),
    getTemplateExerciseRows({ includeInactive: true }),
  ]);

  const exercisesByTemplateId = new Map();

  for (const row of exerciseRows) {
    const currentExercises = exercisesByTemplateId.get(row.template_id) || [];
    currentExercises.push(mapTemplateExerciseRow(row));
    exercisesByTemplateId.set(row.template_id, currentExercises);
  }

  return templatesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    day: row.day,
    day_order: row.day_order === null ? null : Number(row.day_order),
    exercises: exercisesByTemplateId.get(row.id) || [],
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
    [templateId],
  );

  return result.rows[0] || null;
}

async function getTemplateExercises(templateId) {
  await ensureGymSchema();

  const rows = await getTemplateExerciseRows({ templateId, includeInactive: false });
  return rows.map(mapTemplateExerciseRow);
}

async function getTemplateExerciseRows({ templateId = null, includeInactive = false } = {}) {
  const params = [];
  const conditions = [];

  if (templateId !== null) {
    params.push(templateId);
    conditions.push(`te.template_id = $${params.length}`);
  }

  if (!includeInactive) {
    conditions.push('COALESCE(te.is_active, TRUE) = TRUE');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        te.id AS template_exercise_id,
        te.template_id,
        te.exercise_name,
        te.muscle_group,
        te.order_index,
        COALESCE(te.is_active, TRUE) AS is_active,
        ts.id AS template_set_id,
        COALESCE(MAX(ts.target_sets), 1)::int AS target_sets,
        MIN(ts.rep_min)::int AS rep_min,
        MAX(ts.rep_max)::int AS rep_max,
        COALESCE(MAX(NULLIF(TRIM(ts.notes), '')), '') AS notes
      FROM template_exercises te
      LEFT JOIN template_sets ts ON ts.template_exercise_id = te.id
      ${whereClause}
      GROUP BY te.id, te.template_id, te.exercise_name, te.muscle_group, te.order_index, te.is_active, ts.id
      ORDER BY te.template_id ASC, te.order_index ASC, te.id ASC
    `,
    params,
  );

  return result.rows;
}

function mapTemplateExerciseRow(row) {
  return {
    template_exercise_id: row.template_exercise_id,
    template_id: row.template_id === undefined ? null : Number(row.template_id),
    template_set_id: row.template_set_id === null || row.template_set_id === undefined
      ? null
      : Number(row.template_set_id),
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    is_active: row.is_active !== false,
    target_sets: Number(row.target_sets || 1),
    rep_min: row.rep_min === null ? null : Number(row.rep_min),
    rep_max: row.rep_max === null ? null : Number(row.rep_max),
    notes: row.notes || '',
  };
}

async function getActiveSession() {
  await ensureGymSchema();

  const result = await pool.query(`
    SELECT id, date, template_id, status, created_at, updated_at
    FROM gym_sessions
    WHERE status = 'active'
    ORDER BY date DESC, updated_at DESC, id DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function getSessionById(sessionId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, date, template_id, status, created_at, updated_at
      FROM gym_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  return result.rows[0] || null;
}

async function getLatestPreviousSession(templateId, currentSessionId = null) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, date, template_id, status, created_at, updated_at
      FROM gym_sessions
      WHERE template_id = $1
        AND status <> 'active'
        AND ($2::int IS NULL OR id <> $2)
      ORDER BY date DESC, updated_at DESC, id DESC
      LIMIT 1
    `,
    [templateId, currentSessionId],
  );

  return result.rows[0] || null;
}

async function getLatestSessionForDate(templateId, date) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, date, template_id, status, created_at, updated_at
      FROM gym_sessions
      WHERE template_id = $1
        AND date = $2
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [templateId, date],
  );

  return result.rows[0] || null;
}

async function createOrResumeSession({ templateId, date }) {
  await ensureGymSchema();

  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const activeSession = await getActiveSession();
  if (activeSession) {
    return {
      session: activeSession,
      resumed: true,
    };
  }

  const sessionResult = await pool.query(
    `
      INSERT INTO gym_sessions (date, template_id, status, updated_at)
      VALUES ($1, $2, 'active', NOW())
      RETURNING id, date, template_id, status, created_at, updated_at
    `,
    [date, templateId],
  );

  const session = sessionResult.rows[0];

  await pool.query(
    `
      INSERT INTO gym_exercises (session_id, exercise_name, muscle_group, order_index, status, updated_at)
      SELECT $1, exercise_name, muscle_group, order_index, 'pending', NOW()
      FROM template_exercises
      WHERE template_id = $2
        AND COALESCE(is_active, TRUE) = TRUE
      ORDER BY order_index ASC, id ASC
    `,
    [session.id, templateId],
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
        status,
        updated_at
      FROM gym_exercises
      WHERE session_id = $1
      ORDER BY order_index ASC, id ASC
    `,
    [sessionId],
  );

  const setsResult = await pool.query(
    `
      SELECT id, exercise_id, set_number, weight, reps, rir, updated_at
      FROM gym_sets
      WHERE exercise_id = ANY(
        SELECT id FROM gym_exercises WHERE session_id = $1
      )
      ORDER BY exercise_id ASC, set_number ASC, id ASC
    `,
    [sessionId],
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
      updated_at: row.updated_at,
    });
    setsByExerciseId.set(row.exercise_id, current);
  }

  return exercisesResult.rows.map((row) => ({
    session_exercise_id: row.id,
    session_id: row.session_id,
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    status: row.status,
    updated_at: row.updated_at,
    sets: setsByExerciseId.get(row.id) || [],
  }));
}

async function getSessionState(session) {
  await ensureGymSchema();

  if (!session) {
    return null;
  }

  const [template, templateExercises, sessionExercises, previousSession] = await Promise.all([
    getTemplateById(session.template_id),
    getTemplateExercises(session.template_id),
    getSessionExercises(session.id),
    getLatestPreviousSession(session.template_id, session.id),
  ]);

  if (!template) {
    return null;
  }

  const previousSessionExercises = previousSession
    ? await getSessionExercises(previousSession.id)
    : [];

  return {
    template,
    current_session: session,
    last_session: previousSession,
    exercises: buildSessionInitExercises({
      templateExercises,
      currentSessionExercises: sessionExercises,
      previousSessionExercises,
    }),
  };
}

async function getActiveSessionState() {
  await ensureGymSchema();
  const activeSession = await getActiveSession();

  if (!activeSession) {
    return null;
  }

  return getSessionState(activeSession);
}

async function getSessionInit({ templateId, date }) {
  await ensureGymSchema();

  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const todaySession = date ? await getLatestSessionForDate(templateId, date) : null;

  if (todaySession) {
    return getSessionState(todaySession);
  }

  const [templateExercises, previousSession] = await Promise.all([
    getTemplateExercises(templateId),
    getLatestPreviousSession(templateId),
  ]);

  const previousSessionExercises = previousSession
    ? await getSessionExercises(previousSession.id)
    : [];

  return {
    template,
    current_session: null,
    last_session: previousSession,
    exercises: buildSessionInitExercises({
      templateExercises,
      currentSessionExercises: [],
      previousSessionExercises,
    }),
  };
}

function buildSessionInitExercises({
  templateExercises,
  currentSessionExercises,
  previousSessionExercises,
}) {
  if (currentSessionExercises.length > 0) {
    return dedupeExercisePayloads(
      currentSessionExercises.map((sessionExercise) => {
        const templateExercise = findMatchingTemplateExercise(templateExercises, sessionExercise);
        const previousExercise = findMatchingSessionExercise(previousSessionExercises, sessionExercise);

        return buildExercisePayload({
          templateExercise,
          sessionExercise,
          previousExercise,
        });
      }),
    );
  }

  return dedupeExercisePayloads(
    templateExercises.map((templateExercise) => {
      const previousExercise = findMatchingSessionExercise(previousSessionExercises, templateExercise);

      return buildExercisePayload({
        templateExercise,
        sessionExercise: null,
        previousExercise,
      });
    }),
  );
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
    status: sessionExercise?.status || 'pending',
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

function dedupeExercisePayloads(exercises) {
  const dedupedExercises = new Map();

  for (const exercise of exercises) {
    const dedupeKey = `${exercise.order_index}:${normalizeValue(exercise.exercise_name)}`;
    const existingExercise = dedupedExercises.get(dedupeKey);

    if (!existingExercise || shouldReplaceExercise(existingExercise, exercise)) {
      dedupedExercises.set(dedupeKey, exercise);
    }
  }

  return Array.from(dedupedExercises.values()).sort(
    (left, right) => left.order_index - right.order_index,
  );
}

function shouldReplaceExercise(currentExercise, nextExercise) {
  const currentSetCount = currentExercise.sets.length;
  const nextSetCount = nextExercise.sets.length;

  if (nextSetCount !== currentSetCount) {
    return nextSetCount > currentSetCount;
  }

  if (Boolean(nextExercise.session_exercise_id) !== Boolean(currentExercise.session_exercise_id)) {
    return Boolean(nextExercise.session_exercise_id);
  }

  if (nextExercise.status !== currentExercise.status) {
    return nextExercise.status !== 'pending';
  }

  return false;
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

async function createGymExercise({ sessionId, exerciseName, muscleGroup }) {
  await ensureGymSchema();
  const normalizedExerciseName = String(exerciseName || '').trim();

  if (!normalizedExerciseName) {
    const error = new Error('Exercise name is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `
        SELECT id, status
        FROM gym_sessions
        WHERE id = $1
        FOR UPDATE
      `,
      [sessionId],
    );

    if (sessionResult.rowCount === 0) {
      const error = new Error('Gym session not found');
      error.statusCode = 404;
      throw error;
    }

    if (sessionResult.rows[0].status !== 'active') {
      const error = new Error('Session is not active');
      error.statusCode = 409;
      throw error;
    }

    const existingExerciseResult = await client.query(
      `
        SELECT id, session_id, exercise_name, muscle_group, order_index, status, updated_at
        FROM gym_exercises
        WHERE session_id = $1
          AND LOWER(TRIM(exercise_name)) = LOWER(TRIM($2))
        ORDER BY order_index ASC, id ASC
        LIMIT 1
      `,
      [sessionId, normalizedExerciseName],
    );

    if (existingExerciseResult.rowCount > 0) {
      await client.query('COMMIT');
      return mapGymExerciseRow(existingExerciseResult.rows[0]);
    }

    const orderResult = await client.query(
      `
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
        FROM gym_exercises
        WHERE session_id = $1
      `,
      [sessionId],
    );

    const orderIndex = Number(orderResult.rows[0].next_order || 1);
    const result = await client.query(
      `
        INSERT INTO gym_exercises (session_id, exercise_name, muscle_group, order_index, status, updated_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW())
        RETURNING id, session_id, exercise_name, muscle_group, order_index, status, updated_at
      `,
      [sessionId, normalizedExerciseName, muscleGroup || null, orderIndex],
    );

    await client.query('COMMIT');
    return mapGymExerciseRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteGymExercise(exerciseId) {
  await ensureGymSchema();
  await assertExerciseSessionIsActive(exerciseId);

  await pool.query(
    `
      DELETE FROM gym_exercises
      WHERE id = $1
    `,
    [exerciseId],
  );
}

async function updateGymExerciseStatus(exerciseId, status) {
  await ensureGymSchema();
  await assertExerciseSessionIsActive(exerciseId);

  const result = await pool.query(
    `
      UPDATE gym_exercises
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, session_id, status, updated_at
    `,
    [exerciseId, status],
  );

  return result.rows[0] || null;
}

async function listGymSessions() {
  await ensureGymSchema();

  const result = await pool.query(`
    SELECT
      gs.id,
      gs.date,
      gs.template_id,
      gs.status,
      wt.name AS template_name
    FROM gym_sessions gs
    LEFT JOIN workout_templates wt ON wt.id = gs.template_id
    ORDER BY gs.date DESC, gs.created_at DESC, gs.id DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    date: row.date,
    template_id: row.template_id === null ? null : Number(row.template_id),
    template_name: row.template_name || 'No template',
    status: row.status,
  }));
}

async function getGymSessionDetail(sessionId) {
  await ensureGymSchema();

  const sessionResult = await pool.query(
    `
      SELECT
        gs.id,
        gs.date,
        gs.template_id,
        gs.status,
        gs.created_at,
        gs.updated_at,
        wt.name AS template_name
      FROM gym_sessions gs
      LEFT JOIN workout_templates wt ON wt.id = gs.template_id
      WHERE gs.id = $1
    `,
    [sessionId],
  );

  if (sessionResult.rowCount === 0) {
    return null;
  }

  const session = sessionResult.rows[0];
  const exercises = await getSessionExercises(sessionId);

  return {
    id: session.id,
    date: session.date,
    template_id: session.template_id === null ? null : Number(session.template_id),
    template_name: session.template_name || 'No template',
    status: session.status,
    created_at: session.created_at,
    updated_at: session.updated_at,
    exercises,
  };
}

async function updateTemplateName(templateId, name) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE workout_templates
      SET name = $2
      WHERE id = $1
      RETURNING id, name, day, day_order
    `,
    [templateId, name],
  );

  return result.rows[0] || null;
}

async function toggleTemplateExercise(templateExerciseId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE template_exercises
      SET is_active = NOT COALESCE(is_active, TRUE)
      WHERE id = $1
      RETURNING id, template_id, exercise_name, muscle_group, order_index, is_active
    `,
    [templateExerciseId],
  );

  return result.rows[0] || null;
}

async function reorderTemplateExercises(templateId, exercises) {
  await ensureGymSchema();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const templateResult = await client.query(
      `
        SELECT id
        FROM workout_templates
        WHERE id = $1
      `,
      [templateId],
    );

    if (templateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const idList = exercises.map((exercise) => Number(exercise.id));
    const desiredOrder = exercises.map((exercise) => Number(exercise.order_index));

    const existingResult = await client.query(
      `
        SELECT id
        FROM template_exercises
        WHERE template_id = $1
        ORDER BY order_index ASC, id ASC
      `,
      [templateId],
    );

    if (existingResult.rowCount !== idList.length) {
      const error = new Error('Template reorder payload must include every exercise exactly once');
      error.statusCode = 400;
      throw error;
    }

    const existingIds = existingResult.rows.map((row) => Number(row.id)).sort((left, right) => left - right);
    const nextIds = [...idList].sort((left, right) => left - right);

    if (existingIds.length !== nextIds.length || existingIds.some((id, index) => id !== nextIds[index])) {
      const error = new Error('Template reorder payload contains invalid exercise ids');
      error.statusCode = 400;
      throw error;
    }

    for (let index = 0; index < idList.length; index += 1) {
      await client.query(
        `
          UPDATE template_exercises
          SET order_index = $2
          WHERE id = $1
        `,
        [idList[index], -(index + 1)],
      );
    }

    for (let index = 0; index < idList.length; index += 1) {
      await client.query(
        `
          UPDATE template_exercises
          SET order_index = $2
          WHERE id = $1
        `,
        [idList[index], desiredOrder[index]],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const template = await listWorkoutTemplates();
  return template.find((item) => item.id === templateId) || null;
}

async function updateTemplateSet(templateSetId, { targetSets, repMin, repMax }) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE template_sets
      SET target_sets = $2, rep_min = $3, rep_max = $4
      WHERE id = $1
      RETURNING id, template_exercise_id, target_sets, rep_min, rep_max, notes
    `,
    [templateSetId, targetSets, repMin, repMax],
  );

  return result.rows[0] || null;
}

async function getExerciseHistory(exerciseName) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT
        gs.date,
        ge.exercise_name,
        ge.id AS exercise_id,
        gst.set_number,
        gst.weight,
        gst.reps,
        gst.rir
      FROM gym_exercises ge
      JOIN gym_sessions gs ON gs.id = ge.session_id
      JOIN gym_sets gst ON gst.exercise_id = ge.id
      WHERE LOWER(TRIM(ge.exercise_name)) = LOWER(TRIM($1))
      ORDER BY gs.date DESC, gs.id DESC, gst.set_number ASC
    `,
    [exerciseName],
  );

  return result.rows.map((row) => ({
    date: row.date,
    exercise_name: row.exercise_name,
    exercise_id: row.exercise_id,
    set_number: Number(row.set_number),
    weight: row.weight === null ? null : Number(row.weight),
    reps: row.reps === null ? null : Number(row.reps),
    rir: row.rir === null ? null : Number(row.rir),
  }));
}

async function listRecentExercises(limit = 12) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      WITH ranked_exercises AS (
        SELECT
          LOWER(TRIM(ge.exercise_name)) AS normalized_name,
          ge.exercise_name,
          ge.muscle_group,
          MAX(COALESCE(ge.updated_at, gs.updated_at, gs.created_at)) AS last_used_at
        FROM gym_exercises ge
        JOIN gym_sessions gs ON gs.id = ge.session_id
        GROUP BY LOWER(TRIM(ge.exercise_name)), ge.exercise_name, ge.muscle_group
      ),
      deduped_exercises AS (
        SELECT DISTINCT ON (normalized_name)
          exercise_name,
          muscle_group,
          last_used_at
        FROM ranked_exercises
        ORDER BY normalized_name ASC, last_used_at DESC, exercise_name ASC
      )
      SELECT exercise_name, muscle_group, last_used_at
      FROM deduped_exercises
      ORDER BY last_used_at DESC, exercise_name ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    last_used_at: row.last_used_at,
  }));
}

async function duplicateTemplate(templateId) {
  await ensureGymSchema();

  const client = await pool.connect();
  let copiedTemplateId = null;

  try {
    await client.query('BEGIN');

    const templateResult = await client.query(
      `
        SELECT id, name, day, day_order
        FROM workout_templates
        WHERE id = $1
      `,
      [templateId],
    );

    if (templateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const originalTemplate = templateResult.rows[0];
    const copiedTemplateResult = await client.query(
      `
        INSERT INTO workout_templates (name, day, day_order)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [`${originalTemplate.name} (Copy)`, originalTemplate.day, originalTemplate.day_order],
    );

    copiedTemplateId = copiedTemplateResult.rows[0].id;
    const exerciseRows = await client.query(
      `
        SELECT
          te.id,
          te.exercise_name,
          te.muscle_group,
          te.order_index,
          COALESCE(te.is_active, TRUE) AS is_active,
          ts.target_sets,
          ts.rep_min,
          ts.rep_max,
          ts.notes
        FROM template_exercises te
        LEFT JOIN template_sets ts ON ts.template_exercise_id = te.id
        WHERE te.template_id = $1
        ORDER BY te.order_index ASC, te.id ASC
      `,
      [templateId],
    );

    for (const row of exerciseRows.rows) {
      const insertedExerciseResult = await client.query(
        `
          INSERT INTO template_exercises (template_id, exercise_name, muscle_group, order_index, is_active)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [copiedTemplateId, row.exercise_name, row.muscle_group, row.order_index, row.is_active],
      );

      await client.query(
        `
          INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, notes)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          insertedExerciseResult.rows[0].id,
          row.target_sets || 1,
          row.rep_min,
          row.rep_max,
          row.notes,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const templates = await listWorkoutTemplates();
  return templates.find((template) => template.id === copiedTemplateId) || null;
}

async function getExerciseProgress(exerciseName) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      WITH ranked_sessions AS (
        SELECT DISTINCT ON (gs.id)
          gs.id AS session_id,
          gs.date,
          gst.weight,
          gst.reps
        FROM gym_exercises ge
        JOIN gym_sessions gs ON gs.id = ge.session_id
        JOIN gym_sets gst ON gst.exercise_id = ge.id
        WHERE LOWER(TRIM(ge.exercise_name)) = LOWER(TRIM($1))
        ORDER BY gs.id, gst.weight DESC NULLS LAST, gst.reps DESC NULLS LAST, gst.set_number ASC
      )
      SELECT date, weight, reps
      FROM ranked_sessions
      ORDER BY date DESC, session_id DESC
      LIMIT 3
    `,
    [exerciseName],
  );

  return result.rows.map((row) => ({
    date: row.date,
    weight: row.weight === null ? null : Number(row.weight),
    reps: row.reps === null ? null : Number(row.reps),
  }));
}

async function saveGymSet({ exerciseId, setNumber, weight, reps, rir }) {
  await ensureGymSchema();
  await assertExerciseSessionIsActive(exerciseId);

  const result = await pool.query(
    `
      INSERT INTO gym_sets (exercise_id, set_number, weight, reps, rir, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (exercise_id, set_number)
      DO UPDATE SET
        weight = EXCLUDED.weight,
        reps = EXCLUDED.reps,
        rir = EXCLUDED.rir,
        updated_at = NOW()
      RETURNING id, exercise_id, set_number, weight, reps, rir, updated_at
    `,
    [exerciseId, setNumber, weight, reps, rir],
  );

  return {
    id: result.rows[0].id,
    exercise_id: result.rows[0].exercise_id,
    set_number: Number(result.rows[0].set_number),
    weight: result.rows[0].weight === null ? null : Number(result.rows[0].weight),
    reps: result.rows[0].reps === null ? null : Number(result.rows[0].reps),
    rir: result.rows[0].rir === null ? null : Number(result.rows[0].rir),
    updated_at: result.rows[0].updated_at,
  };
}

function mapGymExerciseRow(row) {
  return {
    session_exercise_id: row.id,
    session_id: row.session_id,
    exercise_name: row.exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    status: row.status,
    updated_at: row.updated_at,
    sets: [],
  };
}

async function endGymSession(sessionId) {
  await ensureGymSchema();

  const session = await getSessionById(sessionId);
  if (!session) {
    return { type: 'not_found' };
  }

  if (session.status !== 'active') {
    return { type: 'invalid_status', session };
  }

  const result = await pool.query(
    `
      UPDATE gym_sessions
      SET status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING id, date, template_id, status, created_at, updated_at
    `,
    [sessionId],
  );

  return { type: 'completed', session: result.rows[0] };
}

async function addExerciseToTemplate({ templateId, exerciseName, muscleGroup }) {
  await ensureGymSchema();

  const normalizedExerciseName = String(exerciseName || '').trim();
  if (!normalizedExerciseName) {
    const error = new Error('Exercise name is required');
    error.statusCode = 400;
    throw error;
  }

  const existingExerciseResult = await pool.query(
    `
      SELECT id, template_id, exercise_name, muscle_group, order_index, COALESCE(is_active, TRUE) AS is_active
      FROM template_exercises
      WHERE template_id = $1
        AND LOWER(TRIM(exercise_name)) = LOWER(TRIM($2))
      LIMIT 1
    `,
    [templateId, normalizedExerciseName],
  );

  if (existingExerciseResult.rowCount > 0) {
    const existingExercise = existingExerciseResult.rows[0];

    if (!existingExercise.is_active) {
      const reactivatedResult = await pool.query(
        `
          UPDATE template_exercises
          SET is_active = TRUE
          WHERE id = $1
          RETURNING id, template_id, exercise_name, muscle_group, order_index, is_active
        `,
        [existingExercise.id],
      );

      return reactivatedResult.rows[0];
    }

    return existingExercise;
  }

  const orderResult = await pool.query(
    `
      SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
      FROM template_exercises
      WHERE template_id = $1
    `,
    [templateId],
  );

  const orderIndex = Number(orderResult.rows[0].next_order || 1);

  const exerciseResult = await pool.query(
    `
      INSERT INTO template_exercises (template_id, exercise_name, muscle_group, order_index, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, template_id, exercise_name, muscle_group, order_index, is_active
    `,
    [templateId, normalizedExerciseName, muscleGroup || null, orderIndex],
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
    [exerciseResult.rows[0].id],
  );

  return exerciseResult.rows[0];
}

async function assertSessionIsActive(sessionId) {
  const result = await pool.query(
    `
      SELECT status
      FROM gym_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  if (result.rowCount === 0) {
    const error = new Error('Gym session not found');
    error.statusCode = 404;
    throw error;
  }

  if (result.rows[0].status !== 'active') {
    const error = new Error('Session is not active');
    error.statusCode = 409;
    throw error;
  }
}

async function assertExerciseSessionIsActive(exerciseId) {
  const result = await pool.query(
    `
      SELECT gs.status
      FROM gym_exercises ge
      JOIN gym_sessions gs ON gs.id = ge.session_id
      WHERE ge.id = $1
    `,
    [exerciseId],
  );

  if (result.rowCount === 0) {
    const error = new Error('Gym exercise not found');
    error.statusCode = 404;
    throw error;
  }

  if (result.rows[0].status !== 'active') {
    const error = new Error('Session is not active');
    error.statusCode = 409;
    throw error;
  }
}

module.exports = {
  ensureGymSchema,
  listWorkoutTemplates,
  getActiveSessionState,
  getSessionInit,
  createOrResumeSession,
  createGymExercise,
  deleteGymExercise,
  updateGymExerciseStatus,
  listGymSessions,
  getGymSessionDetail,
  updateTemplateName,
  toggleTemplateExercise,
  reorderTemplateExercises,
  updateTemplateSet,
  getExerciseHistory,
  listRecentExercises,
  duplicateTemplate,
  getExerciseProgress,
  saveGymSet,
  endGymSession,
  addExerciseToTemplate,
};
