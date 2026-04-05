const { pool, ensureGymSchema, getServerToday } = require('./gymShared');

async function getGymAnalysisData({ days = 14, timeZone = 'UTC' } = {}) {
  await ensureGymSchema();
  const today = await getServerToday({ timeZone });
  const params = [today, days];

  const [topExercisesResult, recentWorkoutsResult, progressIndicatorsResult, workoutCountResult] =
    await Promise.all([
      pool.query(
        `
          SELECT
            COALESCE(ex.name, ge.exercise_name) AS exercise_name,
            COUNT(DISTINCT gs.id)::int AS session_count,
            COUNT(gst.id)::int AS set_count,
            COALESCE(MAX(gst.weight), 0)::numeric AS best_weight
          FROM gym_sets gst
          JOIN gym_exercises ge ON ge.id = gst.exercise_id
          JOIN gym_sessions gs ON gs.id = ge.session_id
          LEFT JOIN exercises ex ON ex.id = gst.logged_exercise_id
          WHERE gs.date >= ($1::date - (($2 - 1)::text || ' days')::interval)::date
            AND gs.date <= $1::date
          GROUP BY COALESCE(ex.name, ge.exercise_name)
          ORDER BY session_count DESC, set_count DESC, exercise_name ASC
          LIMIT 5
        `,
        params,
      ),
      pool.query(
        `
          SELECT
            gs.id AS session_id,
            gs.date,
            COALESCE(wt.name, 'Custom workout') AS template_name,
            COUNT(DISTINCT ge.id)::int AS exercise_count,
            COUNT(gst.id)::int AS set_count,
            COALESCE(SUM(COALESCE(gst.weight, 0) * COALESCE(gst.reps, 0)), 0)::numeric AS total_volume
          FROM gym_sessions gs
          LEFT JOIN workout_templates wt ON wt.id = gs.template_id
          LEFT JOIN gym_exercises ge ON ge.session_id = gs.id
          LEFT JOIN gym_sets gst ON gst.exercise_id = ge.id
          WHERE gs.date >= ($1::date - (($2 - 1)::text || ' days')::interval)::date
            AND gs.date <= $1::date
          GROUP BY gs.id, gs.date, wt.name
          ORDER BY gs.date DESC, gs.id DESC
          LIMIT 5
        `,
        params,
      ),
      pool.query(
        `
          WITH per_session AS (
            SELECT
              gs.id AS session_id,
              gs.date,
              COALESCE(ex.name, ge.exercise_name) AS exercise_name,
              COALESCE(MAX(gst.weight), 0)::numeric AS best_weight
            FROM gym_sets gst
            JOIN gym_exercises ge ON ge.id = gst.exercise_id
            JOIN gym_sessions gs ON gs.id = ge.session_id
            LEFT JOIN exercises ex ON ex.id = gst.logged_exercise_id
            WHERE gs.date >= ($1::date - (($2 - 1)::text || ' days')::interval)::date
              AND gs.date <= $1::date
            GROUP BY gs.id, gs.date, COALESCE(ex.name, ge.exercise_name)
          ),
          ranked AS (
            SELECT
              per_session.*,
              LAG(best_weight) OVER (
                PARTITION BY exercise_name
                ORDER BY date ASC, session_id ASC
              ) AS previous_best_weight
            FROM per_session
          ),
          latest AS (
            SELECT
              *,
              ROW_NUMBER() OVER (
                PARTITION BY exercise_name
                ORDER BY date DESC, session_id DESC
              ) AS row_number
            FROM ranked
            WHERE previous_best_weight IS NOT NULL
          )
          SELECT
            exercise_name,
            previous_best_weight,
            best_weight AS current_best_weight,
            (best_weight - previous_best_weight)::numeric AS improvement
          FROM latest
          WHERE row_number = 1
            AND best_weight > previous_best_weight
          ORDER BY improvement DESC, current_best_weight DESC, exercise_name ASC
          LIMIT 5
        `,
        params,
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS workout_count
          FROM gym_sessions gs
          WHERE gs.date >= ($1::date - (($2 - 1)::text || ' days')::interval)::date
            AND gs.date <= $1::date
        `,
        params,
      ),
    ]);

  return {
    topExercises: topExercisesResult.rows.map((row) => ({
      exercise: row.exercise_name,
      sessions: Number(row.session_count || 0),
      sets: Number(row.set_count || 0),
      bestWeight: row.best_weight === null ? null : Number(row.best_weight),
    })),
    recentWorkouts: recentWorkoutsResult.rows.map((row) => ({
      date: row.date,
      workout: row.template_name,
      exercises: Number(row.exercise_count || 0),
      sets: Number(row.set_count || 0),
      totalVolume: Number(row.total_volume || 0),
    })),
    progressIndicators: progressIndicatorsResult.rows.map((row) => ({
      exercise: row.exercise_name,
      trend: `Best weight increased from ${Number(row.previous_best_weight).toFixed(2)} to ${Number(
        row.current_best_weight,
      ).toFixed(2)}`,
      previousBestWeight: Number(row.previous_best_weight),
      currentBestWeight: Number(row.current_best_weight),
    })),
    workoutCount: Number(workoutCountResult.rows[0]?.workout_count || 0),
  };
}

async function getGymHistory(limit = 20) {
  await ensureGymSchema();

  const result = await pool.query(
    `
      SELECT
        gs.date,
        COALESCE(ex.name, ge.exercise_name) AS exercise_name,
        gst.weight,
        gst.reps,
        gst.set_number
      FROM gym_sets gst
      JOIN gym_exercises ge ON ge.id = gst.exercise_id
      JOIN gym_sessions gs ON gs.id = ge.session_id
      LEFT JOIN exercises ex ON ex.id = gst.logged_exercise_id
      ORDER BY gs.date DESC, gs.id DESC, gst.set_number ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    date: row.date,
    exercise: row.exercise_name,
    weight: row.weight === null ? null : Number(row.weight),
    reps: row.reps === null ? null : Number(row.reps),
    sets: Number(row.set_number),
  }));
}

module.exports = {
  getGymAnalysisData,
  getGymHistory,
};
