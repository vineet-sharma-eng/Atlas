const {
  pool,
  ensureGymSchema,
  mapExerciseRecord,
  mapTemplateRecord,
  ensureExerciseRecord,
  getTemplateById,
  getTemplateExerciseRows,
  getTemplateExerciseAlternates,
  getTemplateExercises,
} = require('./gymShared');

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
    currentExercises.push({
      template_exercise_id: Number(row.template_exercise_id),
      template_id: Number(row.template_id),
      exercise_id: row.exercise_id === null ? null : Number(row.exercise_id),
      template_set_id: row.template_set_id === null ? null : Number(row.template_set_id),
      exercise_name: row.exercise_name,
      muscle_group: row.muscle_group,
      order_index: Number(row.order_index),
      is_active: row.is_active !== false,
      target_sets: Number(row.target_sets || 1),
      rep_min: row.rep_min === null ? null : Number(row.rep_min),
      rep_max: row.rep_max === null ? null : Number(row.rep_max),
      target_rir: row.target_rir === null ? null : Number(row.target_rir),
      notes: row.notes || '',
      pinned_note: row.pinned_note_id === null || row.pinned_note_id === undefined
        ? null
        : {
            id: Number(row.pinned_note_id),
            body: row.pinned_note_body,
            updated_at: row.pinned_note_updated_at,
          },
      alternates: row.alternates || [],
    });
    exercisesByTemplateId.set(row.template_id, currentExercises);
  }

  return templatesResult.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    day: row.day,
    day_order: row.day_order === null ? null : Number(row.day_order),
    exercises: exercisesByTemplateId.get(Number(row.id)) || [],
  }));
}

async function listExerciseCatalog({ search = '', limit = 50 } = {}) {
  await ensureGymSchema();
  const params = [];
  let whereClause = '';

  if (search) {
    params.push(`%${search.trim()}%`);
    whereClause = `WHERE ex.name ILIKE $${params.length}`;
  }

  params.push(limit);

  const result = await pool.query(
    `
      SELECT
        ex.id,
        ex.name,
        ex.muscle_group,
        ex.default_target_sets,
        ex.default_rep_min,
        ex.default_rep_max,
        ex.default_target_rir
      FROM exercises ex
      ${whereClause}
      ORDER BY ex.name ASC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map(mapExerciseRecord);
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

  return result.rows[0] ? mapTemplateRecord(result.rows[0]) : null;
}

async function renameExercise(exerciseId, { name, muscleGroup = undefined }) {
  await ensureGymSchema();

  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    const error = new Error('name is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const duplicateResult = await client.query(
      `
        SELECT id
        FROM exercises
        WHERE id <> $1
          AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        LIMIT 1
      `,
      [exerciseId, normalizedName],
    );

    if (duplicateResult.rowCount > 0) {
      const error = new Error('An exercise with this name already exists');
      error.statusCode = 409;
      throw error;
    }

    const updatedExerciseResult = await client.query(
      `
        UPDATE exercises
        SET
          name = $2,
          muscle_group = COALESCE($3, muscle_group),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, muscle_group, default_target_sets, default_rep_min, default_rep_max, default_target_rir
      `,
      [exerciseId, normalizedName, muscleGroup === undefined ? null : muscleGroup],
    );

    if (updatedExerciseResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedExercise = updatedExerciseResult.rows[0];

    await client.query(
      `
        UPDATE template_exercises
        SET
          exercise_name = $2,
          muscle_group = COALESCE($3, muscle_group),
          updated_at = NOW()
        WHERE exercise_id = $1
      `,
      [exerciseId, updatedExercise.name, updatedExercise.muscle_group],
    );

    await client.query(
      `
        UPDATE gym_exercises
        SET
          exercise_name = $2,
          muscle_group = COALESCE($3, muscle_group),
          updated_at = NOW()
        WHERE exercise_id = $1
      `,
      [exerciseId, updatedExercise.name, updatedExercise.muscle_group],
    );

    await client.query('COMMIT');
    return mapExerciseRecord(updatedExercise);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateExerciseDefaults(exerciseId, { targetSets, repMin, repMax, targetRir }) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE exercises
      SET
        default_target_sets = $2,
        default_rep_min = $3,
        default_rep_max = $4,
        default_target_rir = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, muscle_group, default_target_sets, default_rep_min, default_rep_max, default_target_rir
    `,
    [exerciseId, targetSets, repMin, repMax, targetRir],
  );

  return result.rows[0] ? mapExerciseRecord(result.rows[0]) : null;
}

async function listExerciseNotes(exerciseId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT id, exercise_id, body, is_pinned, created_at, updated_at
      FROM exercise_notes
      WHERE exercise_id = $1
      ORDER BY is_pinned DESC, updated_at DESC, id DESC
    `,
    [exerciseId],
  );

  return result.rows.map(mapExerciseNoteRecord);
}

async function createExerciseNote(exerciseId, { body, pin = true }) {
  await ensureGymSchema();
  const normalizedBody = String(body || '').trim();

  if (!normalizedBody) {
    const error = new Error('note body is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertExerciseExists(client, exerciseId);

    if (pin) {
      await client.query(
        `
          UPDATE exercise_notes
          SET is_pinned = FALSE, updated_at = NOW()
          WHERE exercise_id = $1
            AND is_pinned = TRUE
        `,
        [exerciseId],
      );
    }

    const result = await client.query(
      `
        INSERT INTO exercise_notes (exercise_id, body, is_pinned, updated_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, exercise_id, body, is_pinned, created_at, updated_at
      `,
      [exerciseId, normalizedBody, pin],
    );

    await client.query('COMMIT');
    return mapExerciseNoteRecord(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateExerciseNote(exerciseId, noteId, { body, isPinned = undefined }) {
  await ensureGymSchema();
  const normalizedBody = body === undefined ? undefined : String(body || '').trim();

  if (body !== undefined && !normalizedBody) {
    const error = new Error('note body is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
        SELECT id, body, is_pinned
        FROM exercise_notes
        WHERE id = $1
          AND exercise_id = $2
        FOR UPDATE
      `,
      [noteId, exerciseId],
    );

    if (existingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (isPinned === true) {
      await client.query(
        `
          UPDATE exercise_notes
          SET is_pinned = FALSE, updated_at = NOW()
          WHERE exercise_id = $1
            AND id <> $2
            AND is_pinned = TRUE
        `,
        [exerciseId, noteId],
      );
    }

    const result = await client.query(
      `
        UPDATE exercise_notes
        SET
          body = COALESCE($3, body),
          is_pinned = COALESCE($4, is_pinned),
          updated_at = NOW()
        WHERE id = $1
          AND exercise_id = $2
        RETURNING id, exercise_id, body, is_pinned, created_at, updated_at
      `,
      [
        noteId,
        exerciseId,
        normalizedBody === undefined ? null : normalizedBody,
        isPinned === undefined ? null : isPinned,
      ],
    );

    await client.query('COMMIT');
    return mapExerciseNoteRecord(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteExerciseNote(exerciseId, noteId) {
  await ensureGymSchema();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deletedResult = await client.query(
      `
        DELETE FROM exercise_notes
        WHERE id = $1
          AND exercise_id = $2
        RETURNING id, is_pinned
      `,
      [noteId, exerciseId],
    );

    if (deletedResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (deletedResult.rows[0].is_pinned) {
      const replacementResult = await client.query(
        `
          SELECT id
          FROM exercise_notes
          WHERE exercise_id = $1
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `,
        [exerciseId],
      );

      if (replacementResult.rowCount > 0) {
        await client.query(
          `
            UPDATE exercise_notes
            SET is_pinned = TRUE, updated_at = NOW()
            WHERE id = $1
          `,
          [replacementResult.rows[0].id],
        );
      }
    }

    await client.query('COMMIT');
    return { id: Number(deletedResult.rows[0].id) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function toggleTemplateExercise(templateExerciseId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE template_exercises
      SET is_active = NOT COALESCE(is_active, TRUE), updated_at = NOW()
      WHERE id = $1
      RETURNING id, template_id, exercise_id, exercise_name, muscle_group, order_index, is_active
    `,
    [templateExerciseId],
  );

  return result.rows[0]
    ? {
        id: Number(result.rows[0].id),
        template_id: Number(result.rows[0].template_id),
        exercise_id: result.rows[0].exercise_id === null ? null : Number(result.rows[0].exercise_id),
        exercise_name: result.rows[0].exercise_name,
        muscle_group: result.rows[0].muscle_group,
        order_index: Number(result.rows[0].order_index),
        is_active: result.rows[0].is_active !== false,
      }
    : null;
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
          SET order_index = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [idList[index], -(index + 1)],
      );
    }

    for (let index = 0; index < idList.length; index += 1) {
      await client.query(
        `
          UPDATE template_exercises
          SET order_index = $2, updated_at = NOW()
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

  const templates = await listWorkoutTemplates();
  return templates.find((item) => item.id === templateId) || null;
}

async function updateTemplateSet(templateSetId, { targetSets, repMin, repMax, targetRir }) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE template_sets
      SET target_sets = $2, rep_min = $3, rep_max = $4, target_rir = $5
      WHERE id = $1
      RETURNING id, template_exercise_id, target_sets, rep_min, rep_max, target_rir, notes
    `,
    [templateSetId, targetSets, repMin, repMax, targetRir],
  );

  return result.rows[0] || null;
}

async function addExerciseToTemplate({
  templateId,
  exerciseId = null,
  exerciseName,
  muscleGroup,
  targetSets = null,
  repMin = null,
  repMax = null,
  targetRir = null,
}) {
  await ensureGymSchema();
  const normalizedExerciseName = String(exerciseName || '').trim();

  if (!exerciseId && !normalizedExerciseName) {
    const error = new Error('Exercise name is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let exerciseRecord = null;

    if (exerciseId) {
      const exerciseResult = await client.query(
        `
          SELECT
            id,
            name,
            muscle_group,
            default_target_sets,
            default_rep_min,
            default_rep_max,
            default_target_rir
          FROM exercises
          WHERE id = $1
        `,
        [exerciseId],
      );

      if (exerciseResult.rowCount === 0) {
        const error = new Error('Exercise not found');
        error.statusCode = 404;
        throw error;
      }

      exerciseRecord = mapExerciseRecord(exerciseResult.rows[0]);
    } else {
      exerciseRecord = await ensureExerciseRecord(client, {
        name: normalizedExerciseName,
        muscleGroup: muscleGroup || null,
      });
    }

    const existingExerciseResult = await client.query(
      `
        SELECT id, COALESCE(is_active, TRUE) AS is_active
        FROM template_exercises
        WHERE template_id = $1
          AND exercise_id = $2
        LIMIT 1
      `,
      [templateId, exerciseRecord.id],
    );

    if (existingExerciseResult.rowCount > 0) {
      const existingTemplateExerciseId = Number(existingExerciseResult.rows[0].id);

      if (!existingExerciseResult.rows[0].is_active) {
        await client.query(
          `
            UPDATE template_exercises
            SET is_active = TRUE, updated_at = NOW()
            WHERE id = $1
          `,
          [existingTemplateExerciseId],
        );
      }

      if (targetSets || repMin !== null || repMax !== null || targetRir !== null) {
        await client.query(
          `
            INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, target_rir, notes)
            VALUES ($1, $2, $3, $4, $5, NULL)
            ON CONFLICT (template_exercise_id)
            DO UPDATE SET
              target_sets = EXCLUDED.target_sets,
              rep_min = EXCLUDED.rep_min,
              rep_max = EXCLUDED.rep_max,
              target_rir = EXCLUDED.target_rir
          `,
          [
            existingTemplateExerciseId,
            targetSets || exerciseRecord.default_target_sets || 3,
            repMin ?? exerciseRecord.default_rep_min ?? 8,
            repMax ?? exerciseRecord.default_rep_max ?? 12,
            targetRir ?? exerciseRecord.default_target_rir ?? null,
          ],
        );
      }

      await client.query('COMMIT');
      const exercises = await getTemplateExercises(templateId);
      return exercises.find(
        (exercise) => exercise.template_exercise_id === existingTemplateExerciseId,
      ) || null;
    }

    const orderResult = await client.query(
      `
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
        FROM template_exercises
        WHERE template_id = $1
      `,
      [templateId],
    );

    const exerciseResult = await client.query(
      `
        INSERT INTO template_exercises (
          template_id,
          exercise_id,
          exercise_name,
          muscle_group,
          order_index,
          is_active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
        RETURNING id
      `,
      [
        templateId,
        exerciseRecord.id,
        exerciseRecord.name,
        exerciseRecord.muscle_group,
        Number(orderResult.rows[0].next_order || 1),
      ],
    );

    await client.query(
      `
        INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, target_rir, notes)
        SELECT $1, $2, $3, $4, $5, NULL
        WHERE NOT EXISTS (
          SELECT 1
          FROM template_sets
          WHERE template_exercise_id = $1
        )
      `,
      [
        exerciseResult.rows[0].id,
        targetSets || exerciseRecord.default_target_sets || 3,
        repMin ?? exerciseRecord.default_rep_min ?? 8,
        repMax ?? exerciseRecord.default_rep_max ?? 12,
        targetRir ?? exerciseRecord.default_target_rir ?? null,
      ],
    );

    await client.query('COMMIT');
    const exercises = await getTemplateExercises(templateId);
    return exercises.find((exercise) => exercise.template_exercise_id === Number(exerciseResult.rows[0].id)) || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createTemplateExerciseAlternate(templateExerciseId, payload) {
  await ensureGymSchema();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const templateExerciseResult = await client.query(
      `
        SELECT id
        FROM template_exercises
        WHERE id = $1
      `,
      [templateExerciseId],
    );

    if (templateExerciseResult.rowCount === 0) {
      const error = new Error('Template exercise not found');
      error.statusCode = 404;
      throw error;
    }

    let exerciseRecord = null;

    if (payload.exerciseId) {
      const exerciseResult = await client.query(
        `
          SELECT id, name, muscle_group
          FROM exercises
          WHERE id = $1
        `,
        [payload.exerciseId],
      );

      if (exerciseResult.rowCount === 0) {
        const error = new Error('Exercise not found');
        error.statusCode = 404;
        throw error;
      }

      exerciseRecord = mapExerciseRecord(exerciseResult.rows[0]);
    } else {
      exerciseRecord = await ensureExerciseRecord(client, {
        name: payload.name,
        muscleGroup: payload.muscleGroup || null,
      });
    }

    const existingAlternateResult = await client.query(
      `
        SELECT id
        FROM template_exercise_alternates
        WHERE template_exercise_id = $1
          AND exercise_id = $2
        LIMIT 1
      `,
      [templateExerciseId, exerciseRecord.id],
    );

    if (existingAlternateResult.rowCount === 0) {
      await client.query(
        `
        INSERT INTO template_exercise_alternates (
          template_exercise_id,
          exercise_id,
          target_sets,
          rep_min,
          rep_max,
          target_rir,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [
          templateExerciseId,
          exerciseRecord.id,
          payload.targetSets ?? null,
          payload.repMin ?? null,
          payload.repMax ?? null,
          payload.targetRir ?? null,
        ],
      );
    } else if (
      payload.targetSets !== undefined
      || payload.repMin !== undefined
      || payload.repMax !== undefined
      || payload.targetRir !== undefined
    ) {
      await client.query(
        `
          UPDATE template_exercise_alternates
          SET
            target_sets = $3,
            rep_min = $4,
            rep_max = $5,
            target_rir = $6,
            updated_at = NOW()
          WHERE template_exercise_id = $1
            AND exercise_id = $2
        `,
        [
          templateExerciseId,
          exerciseRecord.id,
          payload.targetSets ?? null,
          payload.repMin ?? null,
          payload.repMax ?? null,
          payload.targetRir ?? null,
        ],
      );
    }

    await client.query('COMMIT');
    return getTemplateExerciseAlternates(templateExerciseId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateTemplateExerciseAlternate(alternateId, payload) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      UPDATE template_exercise_alternates
      SET
        target_sets = $2,
        rep_min = $3,
        rep_max = $4,
        target_rir = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING template_exercise_id
    `,
    [
      alternateId,
      payload.targetSets ?? null,
      payload.repMin ?? null,
      payload.repMax ?? null,
      payload.targetRir ?? null,
    ],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return getTemplateExerciseAlternates(Number(result.rows[0].template_exercise_id));
}

async function deleteTemplateExerciseAlternate(alternateId) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      DELETE FROM template_exercise_alternates
      WHERE id = $1
      RETURNING template_exercise_id
    `,
    [alternateId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return getTemplateExerciseAlternates(Number(result.rows[0].template_exercise_id));
}

async function duplicateTemplate(templateId) {
  await ensureGymSchema();

  const client = await pool.connect();
  let copiedTemplateId = null;

  try {
    await client.query('BEGIN');

    const template = await getTemplateById(templateId);
    if (!template) {
      await client.query('ROLLBACK');
      return null;
    }

    const copiedTemplateResult = await client.query(
      `
        INSERT INTO workout_templates (name, day, day_order)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [`${template.name} (Copy)`, template.day, template.day_order],
    );

    copiedTemplateId = Number(copiedTemplateResult.rows[0].id);
    const exerciseRows = await client.query(
      `
        SELECT
          te.id,
          te.exercise_id,
          te.exercise_name,
          te.muscle_group,
          te.order_index,
          COALESCE(te.is_active, TRUE) AS is_active,
          ts.target_sets,
          ts.rep_min,
          ts.rep_max,
          ts.target_rir,
          ts.notes
        FROM template_exercises te
        LEFT JOIN template_sets ts ON ts.template_exercise_id = te.id
        WHERE te.template_id = $1
        ORDER BY te.order_index ASC, te.id ASC
      `,
      [templateId],
    );

    const exerciseIdMap = new Map();

    for (const row of exerciseRows.rows) {
      const insertedExerciseResult = await client.query(
        `
          INSERT INTO template_exercises (
            template_id,
            exercise_id,
            exercise_name,
            muscle_group,
            order_index,
            is_active,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING id
        `,
        [copiedTemplateId, row.exercise_id, row.exercise_name, row.muscle_group, row.order_index, row.is_active],
      );

      const nextTemplateExerciseId = Number(insertedExerciseResult.rows[0].id);
      exerciseIdMap.set(Number(row.id), nextTemplateExerciseId);

      await client.query(
        `
          INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, target_rir, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [nextTemplateExerciseId, row.target_sets || 1, row.rep_min, row.rep_max, row.target_rir, row.notes],
      );
    }

    const alternateRows = await client.query(
      `
        SELECT template_exercise_id, exercise_id, target_sets, rep_min, rep_max, target_rir
        FROM template_exercise_alternates
        WHERE template_exercise_id = ANY($1::int[])
      `,
      [Array.from(exerciseIdMap.keys())],
    );

    for (const row of alternateRows.rows) {
      const nextTemplateExerciseId = exerciseIdMap.get(Number(row.template_exercise_id));

      if (!nextTemplateExerciseId) {
        continue;
      }

      await client.query(
        `
          INSERT INTO template_exercise_alternates (
            template_exercise_id,
            exercise_id,
            target_sets,
            rep_min,
            rep_max,
            target_rir,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (template_exercise_id, exercise_id) DO NOTHING
        `,
        [
          nextTemplateExerciseId,
          row.exercise_id,
          row.target_sets,
          row.rep_min,
          row.rep_max,
          row.target_rir,
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

function mapExerciseNoteRecord(row) {
  return {
    id: Number(row.id),
    exercise_id: Number(row.exercise_id),
    body: row.body,
    is_pinned: row.is_pinned === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function assertExerciseExists(client, exerciseId) {
  const result = await client.query(
    `
      SELECT id
      FROM exercises
      WHERE id = $1
    `,
    [exerciseId],
  );

  if (result.rowCount === 0) {
    const error = new Error('Exercise not found');
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  listWorkoutTemplates,
  listExerciseCatalog,
  updateTemplateName,
  renameExercise,
  updateExerciseDefaults,
  listExerciseNotes,
  createExerciseNote,
  updateExerciseNote,
  deleteExerciseNote,
  toggleTemplateExercise,
  reorderTemplateExercises,
  updateTemplateSet,
  addExerciseToTemplate,
  getTemplateExerciseAlternates,
  createTemplateExerciseAlternate,
  updateTemplateExerciseAlternate,
  deleteTemplateExerciseAlternate,
  duplicateTemplate,
};
