-- =========================
-- WORKOUT TEMPLATES
-- =========================

CREATE TABLE workout_templates (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
day TEXT NOT NULL,
day_order INTEGER,
created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- TEMPLATE EXERCISES
-- =========================

CREATE TABLE template_exercises (
id SERIAL PRIMARY KEY,
template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
exercise_name TEXT NOT NULL,
muscle_group TEXT,
order_index INTEGER NOT NULL,
created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure order is unique per template
CREATE UNIQUE INDEX idx_template_exercise_order
ON template_exercises(template_id, order_index);

-- Prevent duplicate exercises in same template
CREATE UNIQUE INDEX idx_template_exercise_unique
ON template_exercises(template_id, exercise_name);

-- =========================
-- TEMPLATE SETS (TARGETS)
-- =========================

CREATE TABLE template_sets (
id SERIAL PRIMARY KEY,
template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
target_sets INTEGER NOT NULL CHECK (target_sets > 0),
rep_min INTEGER,
rep_max INTEGER,
notes TEXT,
created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- GYM SESSIONS (ACTUAL DATA)
-- =========================

CREATE TABLE gym_sessions (
id SERIAL PRIMARY KEY,
date DATE NOT NULL,
day_label TEXT,

template_id INTEGER
REFERENCES workout_templates(id)
ON DELETE SET NULL,

notes TEXT,

status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'completed', 'abandoned')),

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for fast resume lookup
CREATE INDEX idx_gym_sessions_status
ON gym_sessions(status);

-- =========================
-- GYM EXERCISES (ACTUAL)
-- =========================

CREATE TABLE gym_exercises (
id SERIAL PRIMARY KEY,
session_id INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
exercise_name TEXT NOT NULL,
muscle_group TEXT,
order_index INTEGER NOT NULL,

status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'completed', 'skipped')),

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure exercise order per session
CREATE UNIQUE INDEX idx_gym_exercise_order
ON gym_exercises(session_id, order_index);

-- =========================
-- GYM SETS (ACTUAL)
-- =========================

CREATE TABLE gym_sets (
id SERIAL PRIMARY KEY,
exercise_id INTEGER NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
set_number INTEGER NOT NULL CHECK (set_number > 0),
weight NUMERIC(6,2) NOT NULL CHECK (weight >= 0),
reps INTEGER,
rir INTEGER CHECK (rir BETWEEN 0 AND 5),
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Ensure no duplicate set numbers per exercise
CREATE UNIQUE INDEX idx_gym_set_number
ON gym_sets(exercise_id, set_number);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_gym_exercise_name
ON gym_exercises(exercise_name);

CREATE INDEX idx_template_exercise_name
ON template_exercises(exercise_name);

CREATE INDEX idx_gym_sessions_date
ON gym_sessions(date);
