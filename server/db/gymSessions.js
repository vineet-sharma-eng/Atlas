const {
  pool,
  ensureGymSchema,
  getServerToday,
  normalizeValue,
  ensureExerciseRecord,
  getTemplateById,
  getTemplateExercises,
  getActiveSession,
  getSessionById,
  getLatestPreviousSession,
  getLatestSessionForDate,
  getSessionExercises,
  getSingleSessionExercise,
  assertExerciseSessionIsActive,
} = require('./gymShared');

async function createOrResumeSession({ templateId, date = null, timeZone = 'UTC' }) {
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

  const serverToday = date || await getServerToday({ timeZone });
  const sessionResult = await pool.query(
    `
      INSERT INTO gym_sessions (date, template_id, status, started_at, updated_at)
      VALUES ($1, $2, 'active', NOW(), NOW())
      RETURNING id, date, template_id, status, started_at, ended_at, created_at, updated_at
    `,
    [serverToday, templateId],
  );

  const session = sessionResult.rows[0];

  await pool.query(
    `
      INSERT INTO gym_exercises (
        session_id,
        template_exercise_id,
        exercise_id,
        exercise_name,
        muscle_group,
        order_index,
        status,
        updated_at
      )
      SELECT
        $1,
        te.id,
        te.exercise_id,
        te.exercise_name,
        te.muscle_group,
        te.order_index,
        'pending',
        NOW()
      FROM template_exercises te
      WHERE te.template_id = $2
        AND COALESCE(te.is_active, TRUE) = TRUE
      ORDER BY te.order_index ASC, te.id ASC
    `,
    [session.id, templateId],
  );

  return {
    session,
    resumed: false,
  };
}

async function getSessionState(session, { timeZone = 'UTC' } = {}) {
  await ensureGymSchema();

  if (!session) {
    return null;
  }

  const today = await getServerToday({ timeZone });
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
    today,
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

async function getActiveSessionState({ timeZone = 'UTC' } = {}) {
  await ensureGymSchema();
  const activeSession = await getActiveSession();

  if (!activeSession) {
    return null;
  }

  return getSessionState(activeSession, { timeZone });
}

async function getSessionInit({ templateId, date = null, timeZone = 'UTC' }) {
  await ensureGymSchema();

  const template = await getTemplateById(templateId);
  if (!template) {
    return null;
  }

  const today = date || await getServerToday({ timeZone });
  const todaySession = await getLatestSessionForDate(templateId, today);

  if (todaySession) {
    return getSessionState(todaySession, { timeZone });
  }

  const [templateExercises, previousSession] = await Promise.all([
    getTemplateExercises(templateId),
    getLatestPreviousSession(templateId),
  ]);

  const previousSessionExercises = previousSession
    ? await getSessionExercises(previousSession.id)
    : [];

  return {
    today,
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
    return currentSessionExercises.map((sessionExercise) => {
      const templateExercise = templateExercises.find(
        (candidate) => candidate.template_exercise_id === sessionExercise.template_exercise_id,
      ) || null;
      const previousExercise = findMatchingPreviousExercise(previousSessionExercises, sessionExercise);

      return buildExercisePayload({
        templateExercise,
        sessionExercise,
        previousExercise,
      });
    });
  }

  return templateExercises.map((templateExercise) => {
    const previousExercise = findMatchingPreviousExercise(previousSessionExercises, templateExercise);

    return buildExercisePayload({
      templateExercise,
      sessionExercise: null,
      previousExercise,
    });
  });
}

function buildExercisePayload({ templateExercise, sessionExercise, previousExercise }) {
  const sourceExercise = sessionExercise || templateExercise;
  const targetSets = templateExercise?.target_sets || previousExercise?.sets.length || 1;
  const effectiveExerciseId = sessionExercise?.effective_exercise_id ?? templateExercise?.exercise_id ?? null;
  const effectiveExerciseName = sessionExercise?.effective_exercise_name
    || templateExercise?.exercise_name
    || '';
  const originalExerciseName = sessionExercise?.original_exercise_name
    || templateExercise?.exercise_name
    || effectiveExerciseName;

  return {
    template_exercise_id: sessionExercise?.template_exercise_id ?? templateExercise?.template_exercise_id ?? null,
    template_set_id: templateExercise?.template_set_id ?? null,
    session_exercise_id: sessionExercise?.session_exercise_id ?? null,
    exercise_id: sessionExercise?.exercise_id ?? templateExercise?.exercise_id ?? null,
    effective_exercise_id: effectiveExerciseId,
    override_alternate_id: sessionExercise?.override_alternate_id ?? null,
    override_exercise_id: sessionExercise?.override_exercise_id ?? null,
    exercise_name: effectiveExerciseName,
    original_exercise_name: originalExerciseName,
    effective_exercise_name: effectiveExerciseName,
    is_overridden: sessionExercise?.is_overridden === true,
    muscle_group: sourceExercise?.muscle_group || '',
    order_index: sourceExercise?.order_index || 1,
    target_sets: targetSets,
    rep_min: templateExercise?.rep_min ?? null,
    rep_max: templateExercise?.rep_max ?? null,
    notes: templateExercise?.notes || '',
    status: sessionExercise?.status || 'pending',
    source: templateExercise ? 'template' : 'session',
    can_add_to_template: !templateExercise,
    can_swap: Boolean(templateExercise?.template_exercise_id || sessionExercise?.template_exercise_id),
    alternates: templateExercise?.alternates || sessionExercise?.alternates || [],
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

function findMatchingPreviousExercise(previousSessionExercises, exerciseLike) {
  if (!Array.isArray(previousSessionExercises) || previousSessionExercises.length === 0) {
    return null;
  }

  if (exerciseLike.template_exercise_id) {
    const byTemplateExerciseId = previousSessionExercises.find(
      (candidate) => candidate.template_exercise_id === exerciseLike.template_exercise_id,
    );

    if (byTemplateExerciseId) {
      return byTemplateExerciseId;
    }
  }

  if (exerciseLike.exercise_id) {
    const byExerciseId = previousSessionExercises.find(
      (candidate) => candidate.exercise_id === exerciseLike.exercise_id,
    );

    if (byExerciseId) {
      return byExerciseId;
    }
  }

  const normalizedName = normalizeValue(exerciseLike.exercise_name || exerciseLike.original_exercise_name);

  return previousSessionExercises.find(
    (candidate) => normalizeValue(candidate.original_exercise_name || candidate.exercise_name) === normalizedName,
  ) || null;
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

    const exerciseRecord = await ensureExerciseRecord(client, {
      name: normalizedExerciseName,
      muscleGroup: muscleGroup || null,
    });

    const existingExerciseResult = await client.query(
      `
        SELECT id
        FROM gym_exercises
        WHERE session_id = $1
          AND exercise_id = $2
        ORDER BY order_index ASC, id ASC
        LIMIT 1
      `,
      [sessionId, exerciseRecord.id],
    );

    if (existingExerciseResult.rowCount > 0) {
      await client.query('COMMIT');
      return getSingleSessionExercise(Number(existingExerciseResult.rows[0].id));
    }

    const orderResult = await client.query(
      `
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
        FROM gym_exercises
        WHERE session_id = $1
      `,
      [sessionId],
    );

    const result = await client.query(
      `
        INSERT INTO gym_exercises (
          session_id,
          template_exercise_id,
          exercise_id,
          exercise_name,
          muscle_group,
          order_index,
          status,
          updated_at
        )
        VALUES ($1, NULL, $2, $3, $4, $5, 'pending', NOW())
        RETURNING id
      `,
      [
        sessionId,
        exerciseRecord.id,
        exerciseRecord.name,
        exerciseRecord.muscle_group,
        Number(orderResult.rows[0].next_order || 1),
      ],
    );

    await client.query('COMMIT');
    return getSingleSessionExercise(Number(result.rows[0].id));
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

async function deleteLoggedSessionExercise(exerciseId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      DELETE FROM gym_exercises
      WHERE id = $1
      RETURNING id
    `,
    [exerciseId],
  );

  return result.rows[0] ? { id: Number(result.rows[0].id) } : null;
}

async function deleteGymSession(sessionId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      DELETE FROM gym_sessions
      WHERE id = $1
      RETURNING id
    `,
    [sessionId],
  );

  return result.rows[0] ? { id: Number(result.rows[0].id) } : null;
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

  return result.rows[0]
    ? {
        id: Number(result.rows[0].id),
        session_id: Number(result.rows[0].session_id),
        status: result.rows[0].status,
        updated_at: result.rows[0].updated_at,
      }
    : null;
}

async function listGymSessions() {
  await ensureGymSchema();

  const result = await pool.query(`
    SELECT
      gs.id,
      gs.date,
      gs.template_id,
      gs.status,
      gs.started_at,
      gs.ended_at,
      wt.name AS template_name,
      COUNT(DISTINCT ge.id)::int AS exercise_count,
      COUNT(gst.id)::int AS set_count,
      COALESCE(SUM(COALESCE(gst.weight, 0) * COALESCE(gst.reps, 0)), 0)::numeric AS total_volume
    FROM gym_sessions gs
    LEFT JOIN workout_templates wt ON wt.id = gs.template_id
    LEFT JOIN gym_exercises ge ON ge.session_id = gs.id
    LEFT JOIN gym_sets gst ON gst.exercise_id = ge.id
    GROUP BY gs.id, wt.name
    ORDER BY gs.date DESC, gs.created_at DESC, gs.id DESC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    date: row.date,
    template_id: row.template_id === null ? null : Number(row.template_id),
    template_name: row.template_name || 'No template',
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    exercise_count: Number(row.exercise_count || 0),
    set_count: Number(row.set_count || 0),
    total_volume: Number(row.total_volume || 0),
    has_logged_sets: Number(row.set_count || 0) > 0,
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
        gs.started_at,
        gs.ended_at,
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
  const totalVolume = exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.reduce(
        (setTotal, set) => setTotal + (Number(set.weight || 0) * Number(set.reps || 0)),
        0,
      ),
    0,
  );
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return {
    id: Number(session.id),
    date: session.date,
    template_id: session.template_id === null ? null : Number(session.template_id),
    template_name: session.template_name || 'No template',
    status: session.status,
    started_at: session.started_at,
    ended_at: session.ended_at,
    created_at: session.created_at,
    updated_at: session.updated_at,
    exercise_count: exercises.length,
    set_count: setCount,
    total_volume: totalVolume,
    has_logged_sets: setCount > 0,
    exercises,
  };
}

async function getExerciseHistory(
  exerciseId,
  {
    beforeDate = null,
    limit = 3,
    templateId = null,
    timeZone = 'UTC',
  } = {},
) {
  await ensureGymSchema();
  const today = beforeDate || await getServerToday({ timeZone });
  const params = [exerciseId, today];
  const templateScopeClause = templateId
    ? (() => {
        params.push(templateId);
        return `AND gs.template_id = $${params.length}`;
      })()
    : '';
  params.push(limit);

  // Filter in SQL using the request-localized day boundary so same-day sets
  // never come back as "history" while the user is still on that local date.
  // When a template id is present, keep history inside that workout template
  // so identical exercises in other templates do not leak into this thread.
  const result = await pool.query(
    `
      WITH session_rows AS (
        SELECT
          gs.id AS session_id,
          gs.date,
          gst.exercise_id AS session_exercise_id,
          gst.logged_exercise_id,
          COALESCE(logged_ex.name, ge.exercise_name) AS exercise_name,
          gst.set_number,
          gst.weight,
          gst.reps,
          gst.rir
        FROM gym_sets gst
        JOIN gym_exercises ge ON ge.id = gst.exercise_id
        JOIN gym_sessions gs ON gs.id = ge.session_id
        LEFT JOIN exercises logged_ex ON logged_ex.id = gst.logged_exercise_id
        WHERE gst.logged_exercise_id = $1
          AND gs.date < $2
          ${templateScopeClause}
      ),
      ranked_rows AS (
        SELECT
          session_rows.*,
          DENSE_RANK() OVER (ORDER BY session_rows.date DESC, session_rows.session_id DESC) AS session_rank
        FROM session_rows
      )
      SELECT
        date,
        exercise_name,
        logged_exercise_id AS exercise_id,
        session_exercise_id,
        set_number,
        weight,
        reps,
        rir
      FROM ranked_rows
      WHERE session_rank <= $${params.length}
      ORDER BY date DESC, session_id DESC, set_number ASC
    `,
    params,
  );

  return result.rows.map((row) => ({
    date: row.date,
    exercise_name: row.exercise_name,
    exercise_id: row.exercise_id === null ? null : Number(row.exercise_id),
    session_exercise_id: Number(row.session_exercise_id),
    set_number: Number(row.set_number),
    weight: row.weight === null ? null : Number(row.weight),
    reps: row.reps === null ? null : Number(row.reps),
    rir: row.rir === null ? null : Number(row.rir),
  }));
}

async function getExerciseProgress(
  exerciseId,
  {
    beforeDate = null,
    limit = 3,
    templateId = null,
    timeZone = 'UTC',
  } = {},
) {
  await ensureGymSchema();
  const today = beforeDate || await getServerToday({ timeZone });
  const params = [exerciseId, today];
  const templateScopeClause = templateId
    ? (() => {
        params.push(templateId);
        return `AND gs.template_id = $${params.length}`;
      })()
    : '';
  params.push(limit);

  const result = await pool.query(
    `
      SELECT
        gs.id AS session_id,
        gs.date,
        COUNT(gst.id)::int AS set_count,
        COALESCE(SUM(COALESCE(gst.weight, 0) * COALESCE(gst.reps, 0)), 0)::numeric AS total_volume,
        MAX(gst.weight)::numeric AS best_weight,
        MAX(gst.reps)::int AS best_reps
      FROM gym_sets gst
      JOIN gym_exercises ge ON ge.id = gst.exercise_id
      JOIN gym_sessions gs ON gs.id = ge.session_id
      WHERE gst.logged_exercise_id = $1
        AND gs.date < $2
        ${templateScopeClause}
      GROUP BY gs.id, gs.date
      ORDER BY gs.date DESC, gs.id DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map((row) => ({
    session_id: Number(row.session_id),
    date: row.date,
    set_count: Number(row.set_count || 0),
    total_volume: Number(row.total_volume || 0),
    best_weight: row.best_weight === null ? null : Number(row.best_weight),
    best_reps: row.best_reps === null ? null : Number(row.best_reps),
  }));
}

async function listRecentExercises(limit = 12) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT
        ex.id,
        ex.name,
        ex.muscle_group,
        MAX(COALESCE(gst.updated_at, ge.updated_at, gs.updated_at, gs.created_at)) AS last_used_at
      FROM exercises ex
      JOIN gym_sets gst ON gst.logged_exercise_id = ex.id
      JOIN gym_exercises ge ON ge.id = gst.exercise_id
      JOIN gym_sessions gs ON gs.id = ge.session_id
      GROUP BY ex.id, ex.name, ex.muscle_group
      ORDER BY last_used_at DESC, ex.name ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    exercise_id: Number(row.id),
    exercise_name: row.name,
    muscle_group: row.muscle_group,
    last_used_at: row.last_used_at,
  }));
}

async function saveGymSet({ exerciseId, setNumber, weight, reps, rir }) {
  await ensureGymSchema();
  await assertExerciseSessionIsActive(exerciseId);

  // Snapshot the current effective exercise on each set so today's swap does
  // not leak back into older sets or today's already-logged rows.
  const effectiveExerciseResult = await pool.query(
    `
      SELECT
        COALESCE(override_alt.exercise_id, ge.exercise_id) AS logged_exercise_id
      FROM gym_exercises ge
      LEFT JOIN template_exercise_alternates override_alt ON override_alt.id = ge.override_alternate_id
      WHERE ge.id = $1
    `,
    [exerciseId],
  );

  const loggedExerciseId = effectiveExerciseResult.rows[0]?.logged_exercise_id || null;
  const result = await pool.query(
    `
      INSERT INTO gym_sets (exercise_id, logged_exercise_id, set_number, weight, reps, rir, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (exercise_id, set_number)
      DO UPDATE SET
        logged_exercise_id = EXCLUDED.logged_exercise_id,
        weight = EXCLUDED.weight,
        reps = EXCLUDED.reps,
        rir = EXCLUDED.rir,
        updated_at = NOW()
      RETURNING id, exercise_id, logged_exercise_id, set_number, weight, reps, rir, updated_at
    `,
    [exerciseId, loggedExerciseId, setNumber, weight, reps, rir],
  );

  const loggedExercise = loggedExerciseId
    ? await pool.query(
        `
          SELECT name
          FROM exercises
          WHERE id = $1
        `,
        [loggedExerciseId],
      )
    : { rowCount: 0, rows: [] };

  return {
    id: Number(result.rows[0].id),
    exercise_id: Number(result.rows[0].exercise_id),
    logged_exercise_id: result.rows[0].logged_exercise_id === null ? null : Number(result.rows[0].logged_exercise_id),
    logged_exercise_name: loggedExercise.rowCount > 0 ? loggedExercise.rows[0].name : '',
    set_number: Number(result.rows[0].set_number),
    weight: result.rows[0].weight === null ? null : Number(result.rows[0].weight),
    reps: result.rows[0].reps === null ? null : Number(result.rows[0].reps),
    rir: result.rows[0].rir === null ? null : Number(result.rows[0].rir),
    updated_at: result.rows[0].updated_at,
  };
}

async function updateSessionExerciseOverride(
  sessionExerciseId,
  { overrideAlternateId = null, confirmKeepLoggedSets = false },
) {
  await ensureGymSchema();
  await assertExerciseSessionIsActive(sessionExerciseId);

  const currentExerciseResult = await pool.query(
    `
      SELECT
        ge.id,
        ge.template_exercise_id,
        ge.exercise_id,
        ge.override_alternate_id,
        COALESCE(current_override_alt.exercise_id, ge.exercise_id) AS current_effective_exercise_id,
        COALESCE(current_override_ex.name, current_base_ex.name, ge.exercise_name) AS current_effective_exercise_name,
        COUNT(gst.id)::int AS set_count
      FROM gym_exercises ge
      LEFT JOIN template_exercise_alternates current_override_alt ON current_override_alt.id = ge.override_alternate_id
      LEFT JOIN exercises current_override_ex ON current_override_ex.id = current_override_alt.exercise_id
      LEFT JOIN exercises current_base_ex ON current_base_ex.id = ge.exercise_id
      LEFT JOIN gym_sets gst ON gst.exercise_id = ge.id
      WHERE ge.id = $1
      GROUP BY ge.id, current_override_alt.exercise_id, current_override_ex.name, current_base_ex.name
    `,
    [sessionExerciseId],
  );

  if (currentExerciseResult.rowCount === 0) {
    const error = new Error('Session exercise not found');
    error.statusCode = 404;
    throw error;
  }

  const currentExercise = currentExerciseResult.rows[0];

  if (!currentExercise.template_exercise_id) {
    const error = new Error('Only planned template exercises support alternates');
    error.statusCode = 400;
    throw error;
  }

  let nextAlternateId = null;
  let nextExerciseName = currentExercise.current_effective_exercise_name;
  let nextExerciseId = currentExercise.exercise_id;

  if (overrideAlternateId !== null) {
    const alternateResult = await pool.query(
      `
        SELECT tea.id, tea.exercise_id, ex.name
        FROM template_exercise_alternates tea
        JOIN exercises ex ON ex.id = tea.exercise_id
        WHERE tea.id = $1
          AND tea.template_exercise_id = $2
      `,
      [overrideAlternateId, currentExercise.template_exercise_id],
    );

    if (alternateResult.rowCount === 0) {
      const error = new Error('Alternate exercise not found for this slot');
      error.statusCode = 404;
      throw error;
    }

    nextAlternateId = Number(alternateResult.rows[0].id);
    nextExerciseId = Number(alternateResult.rows[0].exercise_id);
    nextExerciseName = alternateResult.rows[0].name;
  }

  if (
    Number(currentExercise.set_count || 0) > 0
    && Number(currentExercise.current_effective_exercise_id || 0) !== Number(nextExerciseId || 0)
    && !confirmKeepLoggedSets
  ) {
    return {
      type: 'confirmation_required',
      code: 'sets_already_logged',
      message: `You've already logged sets for ${currentExercise.current_effective_exercise_name}. Switch to ${nextExerciseName}? Previously logged sets will be kept as ${currentExercise.current_effective_exercise_name}.`,
    };
  }

  await pool.query(
    `
      UPDATE gym_exercises
      SET override_alternate_id = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [sessionExerciseId, nextAlternateId],
  );

  return {
    type: 'updated',
    exercise: await getSingleSessionExercise(sessionExerciseId),
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
      SET status = 'completed', ended_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, date, template_id, status, started_at, ended_at, created_at, updated_at
    `,
    [sessionId],
  );

  return { type: 'completed', session: result.rows[0] };
}

module.exports = {
  createOrResumeSession,
  getActiveSessionState,
  getSessionInit,
  createGymExercise,
  deleteGymExercise,
  deleteLoggedSessionExercise,
  deleteGymSession,
  updateGymExerciseStatus,
  listGymSessions,
  getGymSessionDetail,
  getExerciseHistory,
  getExerciseProgress,
  listRecentExercises,
  saveGymSet,
  updateSessionExerciseOverride,
  endGymSession,
};
