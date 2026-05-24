ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_target_sets INTEGER CHECK (default_target_sets IS NULL OR default_target_sets > 0);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_rep_min INTEGER CHECK (default_rep_min IS NULL OR default_rep_min > 0);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_rep_max INTEGER CHECK (default_rep_max IS NULL OR default_rep_max > 0);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_target_rir INTEGER CHECK (default_target_rir IS NULL OR default_target_rir BETWEEN 0 AND 4);

ALTER TABLE template_sets
  ADD COLUMN IF NOT EXISTS target_rir INTEGER CHECK (target_rir IS NULL OR target_rir BETWEEN 0 AND 4);

ALTER TABLE template_exercise_alternates
  ADD COLUMN IF NOT EXISTS target_sets INTEGER CHECK (target_sets IS NULL OR target_sets > 0);

ALTER TABLE template_exercise_alternates
  ADD COLUMN IF NOT EXISTS rep_min INTEGER CHECK (rep_min IS NULL OR rep_min > 0);

ALTER TABLE template_exercise_alternates
  ADD COLUMN IF NOT EXISTS rep_max INTEGER CHECK (rep_max IS NULL OR rep_max > 0);

ALTER TABLE template_exercise_alternates
  ADD COLUMN IF NOT EXISTS target_rir INTEGER CHECK (target_rir IS NULL OR target_rir BETWEEN 0 AND 4);

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS target_sets INTEGER CHECK (target_sets IS NULL OR target_sets > 0);

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS rep_min INTEGER CHECK (rep_min IS NULL OR rep_min > 0);

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS rep_max INTEGER CHECK (rep_max IS NULL OR rep_max > 0);

ALTER TABLE gym_exercises
  ADD COLUMN IF NOT EXISTS target_rir INTEGER CHECK (target_rir IS NULL OR target_rir BETWEEN 0 AND 4);

UPDATE gym_exercises AS ge
SET
  target_sets = COALESCE(ge.target_sets, ts.target_sets, ex.default_target_sets, 1),
  rep_min = COALESCE(ge.rep_min, ts.rep_min, ex.default_rep_min),
  rep_max = COALESCE(ge.rep_max, ts.rep_max, ex.default_rep_max),
  target_rir = COALESCE(ge.target_rir, ts.target_rir, ex.default_target_rir),
  updated_at = NOW()
FROM template_exercises AS te
LEFT JOIN template_sets AS ts ON ts.template_exercise_id = te.id
LEFT JOIN exercises AS ex ON ex.id = te.exercise_id
WHERE ge.template_exercise_id = te.id
  AND (
    ge.target_sets IS NULL
    OR ge.rep_min IS NULL
    OR ge.rep_max IS NULL
    OR ge.target_rir IS NULL
  );

UPDATE gym_exercises AS ge
SET
  target_sets = COALESCE(ge.target_sets, ex.default_target_sets, 1),
  rep_min = COALESCE(ge.rep_min, ex.default_rep_min),
  rep_max = COALESCE(ge.rep_max, ex.default_rep_max),
  target_rir = COALESCE(ge.target_rir, ex.default_target_rir),
  updated_at = NOW()
FROM exercises AS ex
WHERE ge.template_exercise_id IS NULL
  AND ge.exercise_id = ex.id
  AND (
    ge.target_sets IS NULL
    OR ge.rep_min IS NULL
    OR ge.rep_max IS NULL
    OR ge.target_rir IS NULL
  );

UPDATE gym_exercises
SET target_sets = 1
WHERE target_sets IS NULL;

CREATE TABLE IF NOT EXISTS exercise_notes (
  id SERIAL PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (BTRIM(body) <> ''),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_notes_single_pinned
ON exercise_notes (exercise_id)
WHERE is_pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_exercise_notes_exercise_updated
ON exercise_notes (exercise_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_gym_exercises_effective_targets
ON gym_exercises (exercise_id, target_sets);
