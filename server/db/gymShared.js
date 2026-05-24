const pool = require('./pool');
const { runMigrationsOnce } = require('./migrationRunner');

let schemaReadyPromise;

async function ensureGymSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureGymSchemaInternal();
  }

  return schemaReadyPromise;
}

async function ensureGymSchemaInternal() {
  await runMigrationsOnce();
}

function resolveUserTimeZone(candidate) {
  const nextTimeZone = String(candidate || '').trim();

  if (!nextTimeZone) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: nextTimeZone }).format(new Date());
    return nextTimeZone;
  } catch (_) {
    return 'UTC';
  }
}

async function getServerToday({ client = pool, timeZone = 'UTC' } = {}) {
  const result = await client.query(
    `
      SELECT TO_CHAR(timezone($1, CURRENT_TIMESTAMP)::date, 'YYYY-MM-DD') AS today
    `,
    [resolveUserTimeZone(timeZone)],
  );

  return result.rows[0].today;
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function mapExerciseRecord(row) {
  return {
    id: Number(row.id),
    name: row.name,
    muscle_group: row.muscle_group,
    default_target_sets: row.default_target_sets === null || row.default_target_sets === undefined
      ? null
      : Number(row.default_target_sets),
    default_rep_min: row.default_rep_min === null || row.default_rep_min === undefined
      ? null
      : Number(row.default_rep_min),
    default_rep_max: row.default_rep_max === null || row.default_rep_max === undefined
      ? null
      : Number(row.default_rep_max),
    default_target_rir: row.default_target_rir === null || row.default_target_rir === undefined
      ? null
      : Number(row.default_target_rir),
  };
}

function mapTemplateRecord(row) {
  return {
    id: Number(row.id),
    name: row.name,
    day: row.day,
    day_order: row.day_order === null ? null : Number(row.day_order),
  };
}

async function ensureExerciseRecord(client, { name, muscleGroup = null }) {
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    const error = new Error('Exercise name is required');
    error.statusCode = 400;
    throw error;
  }

  const existingResult = await client.query(
    `
      SELECT id, name, muscle_group
        , default_target_sets, default_rep_min, default_rep_max, default_target_rir
      FROM exercises
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
      LIMIT 1
    `,
    [normalizedName],
  );

  if (existingResult.rowCount > 0) {
    const existingExercise = existingResult.rows[0];

    if (!existingExercise.muscle_group && muscleGroup) {
      const updatedResult = await client.query(
        `
          UPDATE exercises
          SET muscle_group = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, muscle_group, default_target_sets, default_rep_min, default_rep_max, default_target_rir
        `,
        [existingExercise.id, muscleGroup],
      );

      return mapExerciseRecord(updatedResult.rows[0]);
    }

    return mapExerciseRecord(existingResult.rows[0]);
  }

  const insertedResult = await client.query(
    `
      INSERT INTO exercises (name, muscle_group, updated_at)
      VALUES ($1, $2, NOW())
      RETURNING id, name, muscle_group, default_target_sets, default_rep_min, default_rep_max, default_target_rir
    `,
    [normalizedName, muscleGroup || null],
  );

  return mapExerciseRecord(insertedResult.rows[0]);
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

  return result.rows[0] ? mapTemplateRecord(result.rows[0]) : null;
}

async function getTemplateExerciseAlternatesMap(templateExerciseIds) {
  const ids = Array.from(new Set(templateExerciseIds.filter(Boolean).map(Number)));

  if (ids.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `
      SELECT
        tea.id,
        tea.template_exercise_id,
        tea.exercise_id,
        ex.name AS exercise_name,
        ex.muscle_group,
        tea.target_sets,
        tea.rep_min,
        tea.rep_max,
        tea.target_rir
      FROM template_exercise_alternates tea
      JOIN exercises ex ON ex.id = tea.exercise_id
      WHERE tea.template_exercise_id = ANY($1::int[])
      ORDER BY ex.name ASC, tea.id ASC
    `,
    [ids],
  );

  const alternatesByTemplateExerciseId = new Map();

  for (const row of result.rows) {
    const key = Number(row.template_exercise_id);
    const currentAlternates = alternatesByTemplateExerciseId.get(key) || [];
    currentAlternates.push({
      id: Number(row.id),
      template_exercise_id: key,
      exercise_id: Number(row.exercise_id),
      exercise_name: row.exercise_name,
      muscle_group: row.muscle_group,
      target_sets: row.target_sets === null ? null : Number(row.target_sets),
      rep_min: row.rep_min === null ? null : Number(row.rep_min),
      rep_max: row.rep_max === null ? null : Number(row.rep_max),
      target_rir: row.target_rir === null ? null : Number(row.target_rir),
    });
    alternatesByTemplateExerciseId.set(key, currentAlternates);
  }

  return alternatesByTemplateExerciseId;
}

async function getTemplateExerciseAlternates(templateExerciseId) {
  await ensureGymSchema();
  const alternatesByTemplateExerciseId = await getTemplateExerciseAlternatesMap([templateExerciseId]);
  return alternatesByTemplateExerciseId.get(Number(templateExerciseId)) || [];
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
        te.exercise_id,
        COALESCE(ex.name, te.exercise_name) AS exercise_name,
        COALESCE(ex.muscle_group, te.muscle_group) AS muscle_group,
        te.order_index,
        COALESCE(te.is_active, TRUE) AS is_active,
        ts.id AS template_set_id,
        COALESCE(MAX(ts.target_sets), 1)::int AS target_sets,
        MIN(ts.rep_min)::int AS rep_min,
        MAX(ts.rep_max)::int AS rep_max,
        MAX(ts.target_rir)::int AS target_rir,
        COALESCE(MAX(NULLIF(TRIM(ts.notes), '')), '') AS notes,
        pinned_note.id AS pinned_note_id,
        pinned_note.body AS pinned_note_body,
        pinned_note.updated_at AS pinned_note_updated_at
      FROM template_exercises te
      LEFT JOIN exercises ex ON ex.id = te.exercise_id
      LEFT JOIN template_sets ts ON ts.template_exercise_id = te.id
      LEFT JOIN exercise_notes pinned_note
        ON pinned_note.exercise_id = te.exercise_id
       AND pinned_note.is_pinned = TRUE
      ${whereClause}
      GROUP BY
        te.id,
        te.template_id,
        te.exercise_id,
        ex.name,
        ex.muscle_group,
        te.exercise_name,
        te.muscle_group,
        te.order_index,
        te.is_active,
        ts.id,
        pinned_note.id,
        pinned_note.body,
        pinned_note.updated_at
      ORDER BY te.template_id ASC, te.order_index ASC, te.id ASC
    `,
    params,
  );

  const alternatesByTemplateExerciseId = await getTemplateExerciseAlternatesMap(
    result.rows.map((row) => Number(row.template_exercise_id)),
  );

  return result.rows.map((row) => ({
    ...row,
    alternates: alternatesByTemplateExerciseId.get(Number(row.template_exercise_id)) || [],
  }));
}

function mapTemplateExerciseRow(row) {
  return {
    template_exercise_id: Number(row.template_exercise_id),
    template_id: row.template_id === undefined ? null : Number(row.template_id),
    exercise_id: row.exercise_id === null || row.exercise_id === undefined ? null : Number(row.exercise_id),
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
    target_rir: row.target_rir === null || row.target_rir === undefined ? null : Number(row.target_rir),
    notes: row.notes || '',
    pinned_note: row.pinned_note_id === null || row.pinned_note_id === undefined
      ? null
      : {
          id: Number(row.pinned_note_id),
          body: row.pinned_note_body,
          updated_at: row.pinned_note_updated_at,
        },
    alternates: Array.isArray(row.alternates) ? row.alternates : [],
  };
}

async function getTemplateExercises(templateId) {
  await ensureGymSchema();
  const rows = await getTemplateExerciseRows({ templateId, includeInactive: false });
  return rows.map(mapTemplateExerciseRow);
}

async function getActiveSession() {
  await ensureGymSchema();

  const result = await pool.query(`
    SELECT id, date, template_id, status, started_at, ended_at, created_at, updated_at
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
      SELECT id, date, template_id, status, started_at, ended_at, created_at, updated_at
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
      SELECT id, date, template_id, status, started_at, ended_at, created_at, updated_at
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
      SELECT id, date, template_id, status, started_at, ended_at, created_at, updated_at
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

async function getSessionExercises(sessionId) {
  await ensureGymSchema();

  const exercisesResult = await pool.query(
    `
      SELECT
        ge.id,
        ge.session_id,
        ge.template_exercise_id,
        ge.exercise_id,
        COALESCE(base_ex.name, ge.exercise_name) AS original_exercise_name,
        COALESCE(base_ex.muscle_group, ge.muscle_group) AS muscle_group,
        ge.order_index,
        ge.status,
        ge.override_alternate_id,
        override_alt.exercise_id AS override_exercise_id,
        override_ex.name AS override_exercise_name,
        COALESCE(override_ex.id, base_ex.id, ge.exercise_id) AS effective_exercise_id,
        COALESCE(override_ex.name, base_ex.name, ge.exercise_name) AS effective_exercise_name,
        ge.target_sets,
        ge.rep_min,
        ge.rep_max,
        ge.target_rir,
        pinned_note.id AS pinned_note_id,
        pinned_note.body AS pinned_note_body,
        pinned_note.updated_at AS pinned_note_updated_at,
        ge.updated_at
      FROM gym_exercises ge
      LEFT JOIN exercises base_ex ON base_ex.id = ge.exercise_id
      LEFT JOIN template_exercise_alternates override_alt ON override_alt.id = ge.override_alternate_id
      LEFT JOIN exercises override_ex ON override_ex.id = override_alt.exercise_id
      LEFT JOIN exercise_notes pinned_note
        ON pinned_note.exercise_id = COALESCE(override_ex.id, base_ex.id, ge.exercise_id)
       AND pinned_note.is_pinned = TRUE
      WHERE ge.session_id = $1
      ORDER BY ge.order_index ASC, ge.id ASC
    `,
    [sessionId],
  );

  const setsResult = await pool.query(
    `
      SELECT
        gst.id,
        gst.exercise_id,
        gst.logged_exercise_id,
        logged_ex.name AS logged_exercise_name,
        gst.set_number,
        gst.weight,
        gst.reps,
        gst.rir,
        gst.updated_at
      FROM gym_sets gst
      LEFT JOIN exercises logged_ex ON logged_ex.id = gst.logged_exercise_id
      WHERE gst.exercise_id = ANY(
        SELECT id FROM gym_exercises WHERE session_id = $1
      )
      ORDER BY gst.exercise_id ASC, gst.set_number ASC, gst.id ASC
    `,
    [sessionId],
  );

  const alternatesByTemplateExerciseId = await getTemplateExerciseAlternatesMap(
    exercisesResult.rows
      .map((row) => (row.template_exercise_id === null ? null : Number(row.template_exercise_id)))
      .filter(Boolean),
  );

  const setsByExerciseId = new Map();

  for (const row of setsResult.rows) {
    const key = Number(row.exercise_id);
    const currentSets = setsByExerciseId.get(key) || [];
    currentSets.push({
      id: Number(row.id),
      exercise_id: key,
      logged_exercise_id: row.logged_exercise_id === null ? null : Number(row.logged_exercise_id),
      logged_exercise_name: row.logged_exercise_name || '',
      set_number: Number(row.set_number),
      weight: row.weight === null ? null : Number(row.weight),
      reps: row.reps === null ? null : Number(row.reps),
      rir: row.rir === null ? null : Number(row.rir),
      updated_at: row.updated_at,
    });
    setsByExerciseId.set(key, currentSets);
  }

  return exercisesResult.rows.map((row) => ({
    session_exercise_id: Number(row.id),
    session_id: Number(row.session_id),
    template_exercise_id: row.template_exercise_id === null ? null : Number(row.template_exercise_id),
    exercise_id: row.exercise_id === null ? null : Number(row.exercise_id),
    original_exercise_name: row.original_exercise_name,
    override_alternate_id: row.override_alternate_id === null ? null : Number(row.override_alternate_id),
    override_exercise_id: row.override_exercise_id === null ? null : Number(row.override_exercise_id),
    effective_exercise_id: row.effective_exercise_id === null ? null : Number(row.effective_exercise_id),
    effective_exercise_name: row.effective_exercise_name,
    exercise_name: row.effective_exercise_name,
    muscle_group: row.muscle_group,
    order_index: Number(row.order_index),
    target_sets: Number(row.target_sets || 1),
    rep_min: row.rep_min === null ? null : Number(row.rep_min),
    rep_max: row.rep_max === null ? null : Number(row.rep_max),
    target_rir: row.target_rir === null ? null : Number(row.target_rir),
    pinned_note: row.pinned_note_id === null
      ? null
      : {
          id: Number(row.pinned_note_id),
          body: row.pinned_note_body,
          updated_at: row.pinned_note_updated_at,
        },
    status: row.status,
    updated_at: row.updated_at,
    is_overridden: row.override_alternate_id !== null,
    alternates: row.template_exercise_id === null
      ? []
      : alternatesByTemplateExerciseId.get(Number(row.template_exercise_id)) || [],
    sets: setsByExerciseId.get(Number(row.id)) || [],
  }));
}

async function getSingleSessionExercise(sessionExerciseId) {
  const exerciseResult = await pool.query(
    `
      SELECT session_id
      FROM gym_exercises
      WHERE id = $1
    `,
    [sessionExerciseId],
  );

  if (exerciseResult.rowCount === 0) {
    return null;
  }

  const sessionExercises = await getSessionExercises(Number(exerciseResult.rows[0].session_id));
  return sessionExercises.find((exercise) => exercise.session_exercise_id === Number(sessionExerciseId)) || null;
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
  pool,
  ensureGymSchema,
  getServerToday,
  normalizeValue,
  mapExerciseRecord,
  mapTemplateRecord,
  ensureExerciseRecord,
  getTemplateById,
  getTemplateExerciseAlternatesMap,
  getTemplateExerciseAlternates,
  getTemplateExerciseRows,
  mapTemplateExerciseRow,
  getTemplateExercises,
  getActiveSession,
  getSessionById,
  getLatestPreviousSession,
  getLatestSessionForDate,
  getSessionExercises,
  getSingleSessionExercise,
  assertSessionIsActive,
  assertExerciseSessionIsActive,
};
