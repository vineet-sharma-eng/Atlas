CREATE TABLE IF NOT EXISTS workout_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  day TEXT,
  day_order INTEGER
);

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS muscle_group TEXT;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS template_exercises (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 1;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS template_sets (
  id SERIAL PRIMARY KEY,
  template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  target_sets INTEGER NOT NULL DEFAULT 1,
  rep_min INTEGER,
  rep_max INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS template_exercise_alternates (
  id SERIAL PRIMARY KEY,
  template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_sessions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gym_sessions
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL;

ALTER TABLE gym_sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE gym_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS gym_exercises (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
  template_exercise_id INTEGER REFERENCES template_exercises(id) ON DELETE SET NULL,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  override_alternate_id INTEGER REFERENCES template_exercise_alternates(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS template_exercise_id INTEGER REFERENCES template_exercises(id) ON DELETE SET NULL;

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS override_alternate_id INTEGER REFERENCES template_exercise_alternates(id) ON DELETE SET NULL;

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS gym_sets (
  id SERIAL PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
  logged_exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  set_number INTEGER NOT NULL,
  weight NUMERIC(10, 2) NOT NULL DEFAULT 0,
  reps INTEGER,
  rir INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gym_sets
  ADD COLUMN IF NOT EXISTS logged_exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE gym_sets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

WITH canonical_sources AS (
  SELECT BTRIM(exercise_name) AS raw_name, NULLIF(BTRIM(muscle_group), '') AS muscle_group
  FROM template_exercises
  WHERE exercise_name IS NOT NULL

  UNION ALL

  SELECT BTRIM(exercise_name) AS raw_name, NULLIF(BTRIM(muscle_group), '') AS muscle_group
  FROM gym_exercises
  WHERE exercise_name IS NOT NULL

  UNION ALL

  SELECT BTRIM(name) AS raw_name, NULLIF(BTRIM(muscle_group), '') AS muscle_group
  FROM exercises
  WHERE name IS NOT NULL
),
normalized_sources AS (
  SELECT
    LOWER(REGEXP_REPLACE(REPLACE(raw_name, '_', ' '), '\s+', ' ', 'g')) AS canonical_key,
    INITCAP(REGEXP_REPLACE(REPLACE(raw_name, '_', ' '), '\s+', ' ', 'g')) AS canonical_name,
    muscle_group
  FROM canonical_sources
  WHERE raw_name <> ''
),
canonical_rows AS (
  SELECT
    canonical_key,
    MIN(canonical_name) AS canonical_name,
    MAX(muscle_group) FILTER (WHERE muscle_group IS NOT NULL) AS canonical_muscle_group
  FROM normalized_sources
  GROUP BY canonical_key
)
INSERT INTO exercises (name, muscle_group)
SELECT canonical_name, canonical_muscle_group
FROM canonical_rows
ON CONFLICT ((LOWER(TRIM(name)))) DO NOTHING;

DROP TABLE IF EXISTS tmp_gym_exercise_canonical_map;

CREATE TEMP TABLE tmp_gym_exercise_canonical_map AS
SELECT
  LOWER(REGEXP_REPLACE(REPLACE(BTRIM(name), '_', ' '), '\s+', ' ', 'g')) AS canonical_key,
  MIN(id) AS keep_id,
  MIN(INITCAP(REGEXP_REPLACE(REPLACE(BTRIM(name), '_', ' '), '\s+', ' ', 'g'))) AS canonical_name,
  MAX(NULLIF(BTRIM(muscle_group), '')) AS canonical_muscle_group
FROM exercises
WHERE BTRIM(name) <> ''
GROUP BY LOWER(REGEXP_REPLACE(REPLACE(BTRIM(name), '_', ' '), '\s+', ' ', 'g'));

UPDATE template_exercises AS te
SET exercise_id = canonical.keep_id,
    updated_at = NOW()
FROM exercises AS ex
JOIN tmp_gym_exercise_canonical_map AS canonical
  ON canonical.canonical_key = LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ex.name), '_', ' '), '\s+', ' ', 'g'))
WHERE te.exercise_id = ex.id
  AND te.exercise_id IS DISTINCT FROM canonical.keep_id;

UPDATE gym_exercises AS ge
SET exercise_id = canonical.keep_id,
    updated_at = NOW()
FROM exercises AS ex
JOIN tmp_gym_exercise_canonical_map AS canonical
  ON canonical.canonical_key = LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ex.name), '_', ' '), '\s+', ' ', 'g'))
WHERE ge.exercise_id = ex.id
  AND ge.exercise_id IS DISTINCT FROM canonical.keep_id;

UPDATE gym_sets AS gst
SET logged_exercise_id = canonical.keep_id,
    updated_at = NOW()
FROM exercises AS ex
JOIN tmp_gym_exercise_canonical_map AS canonical
  ON canonical.canonical_key = LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ex.name), '_', ' '), '\s+', ' ', 'g'))
WHERE gst.logged_exercise_id = ex.id
  AND gst.logged_exercise_id IS DISTINCT FROM canonical.keep_id;

UPDATE template_exercise_alternates AS tea
SET exercise_id = canonical.keep_id,
    updated_at = NOW()
FROM exercises AS ex
JOIN tmp_gym_exercise_canonical_map AS canonical
  ON canonical.canonical_key = LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ex.name), '_', ' '), '\s+', ' ', 'g'))
WHERE tea.exercise_id = ex.id
  AND tea.exercise_id IS DISTINCT FROM canonical.keep_id;

DELETE FROM exercises AS ex
USING tmp_gym_exercise_canonical_map AS canonical
WHERE canonical.canonical_key = LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ex.name), '_', ' '), '\s+', ' ', 'g'))
  AND ex.id <> canonical.keep_id;

UPDATE exercises AS ex
SET name = canonical.canonical_name,
    muscle_group = COALESCE(NULLIF(BTRIM(ex.muscle_group), ''), canonical.canonical_muscle_group),
    updated_at = NOW()
FROM tmp_gym_exercise_canonical_map AS canonical
WHERE ex.id = canonical.keep_id
  AND (
    ex.name IS DISTINCT FROM canonical.canonical_name
    OR COALESCE(NULLIF(BTRIM(ex.muscle_group), ''), '') IS DISTINCT FROM COALESCE(canonical.canonical_muscle_group, '')
  );

UPDATE template_exercises AS te
SET exercise_id = ex.id,
    exercise_name = ex.name,
    muscle_group = COALESCE(NULLIF(BTRIM(te.muscle_group), ''), ex.muscle_group),
    updated_at = NOW()
FROM exercises AS ex
WHERE LOWER(REGEXP_REPLACE(REPLACE(BTRIM(te.exercise_name), '_', ' '), '\s+', ' ', 'g')) = LOWER(TRIM(ex.name))
  AND (
    te.exercise_id IS DISTINCT FROM ex.id
    OR te.exercise_name IS DISTINCT FROM ex.name
    OR COALESCE(NULLIF(BTRIM(te.muscle_group), ''), '') IS DISTINCT FROM COALESCE(ex.muscle_group, '')
  );

UPDATE gym_exercises AS ge
SET exercise_id = ex.id,
    exercise_name = ex.name,
    muscle_group = COALESCE(NULLIF(BTRIM(ge.muscle_group), ''), ex.muscle_group),
    updated_at = NOW()
FROM exercises AS ex
WHERE LOWER(REGEXP_REPLACE(REPLACE(BTRIM(ge.exercise_name), '_', ' '), '\s+', ' ', 'g')) = LOWER(TRIM(ex.name))
  AND (
    ge.exercise_id IS DISTINCT FROM ex.id
    OR ge.exercise_name IS DISTINCT FROM ex.name
    OR COALESCE(NULLIF(BTRIM(ge.muscle_group), ''), '') IS DISTINCT FROM COALESCE(ex.muscle_group, '')
  );

UPDATE gym_exercises AS ge
SET template_exercise_id = te.id,
    updated_at = NOW()
FROM gym_sessions AS gs
JOIN template_exercises AS te
  ON te.template_id = gs.template_id
WHERE ge.session_id = gs.id
  AND gs.template_id IS NOT NULL
  AND ge.template_exercise_id IS NULL
  AND te.order_index = ge.order_index
  AND (
    (ge.exercise_id IS NOT NULL AND te.exercise_id = ge.exercise_id)
    OR LOWER(TRIM(te.exercise_name)) = LOWER(TRIM(ge.exercise_name))
  );

UPDATE gym_sets AS gst
SET logged_exercise_id = ge.exercise_id,
    updated_at = NOW()
FROM gym_exercises AS ge
WHERE gst.exercise_id = ge.id
  AND gst.logged_exercise_id IS NULL
  AND ge.exercise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name_unique
ON exercises (LOWER(TRIM(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_exercise_unique
ON template_exercises (template_id, exercise_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_exercise_order
ON template_exercises (template_id, order_index);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_sets_unique
ON template_sets (template_exercise_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_exercise_alternates_unique
ON template_exercise_alternates (template_exercise_id, exercise_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_sets_exercise_number
ON gym_sets (exercise_id, set_number);

CREATE INDEX IF NOT EXISTS idx_gym_sets_logged_exercise_id
ON gym_sets (logged_exercise_id);

CREATE INDEX IF NOT EXISTS idx_gym_sessions_date
ON gym_sessions (date);
