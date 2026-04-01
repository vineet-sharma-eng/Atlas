CREATE TABLE workout_templates (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
day TEXT NOT NULL,
day_order INTEGER,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exercises (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
muscle_group TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_exercises_name_unique
ON exercises (LOWER(TRIM(name)));

CREATE TABLE template_exercises (
id SERIAL PRIMARY KEY,
template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
exercise_name TEXT NOT NULL,
muscle_group TEXT,
order_index INTEGER NOT NULL,
is_active BOOLEAN NOT NULL DEFAULT TRUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_template_exercise_order
ON template_exercises(template_id, order_index);

CREATE UNIQUE INDEX idx_template_exercise_unique
ON template_exercises(template_id, exercise_name);

CREATE TABLE template_sets (
id SERIAL PRIMARY KEY,
template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
target_sets INTEGER NOT NULL CHECK (target_sets > 0),
rep_min INTEGER,
rep_max INTEGER,
notes TEXT,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_template_sets_unique
ON template_sets(template_exercise_id);

CREATE TABLE template_exercise_alternates (
id SERIAL PRIMARY KEY,
template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_template_exercise_alternates_unique
ON template_exercise_alternates(template_exercise_id, exercise_id);

CREATE TABLE gym_sessions (
id SERIAL PRIMARY KEY,
date DATE NOT NULL,
day_label TEXT,
template_id INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL,
notes TEXT,
status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'completed', 'abandoned')),
started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
ended_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_gym_sessions_status
ON gym_sessions(status);

CREATE TABLE gym_exercises (
id SERIAL PRIMARY KEY,
session_id INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
template_exercise_id INTEGER REFERENCES template_exercises(id) ON DELETE SET NULL,
exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
override_alternate_id INTEGER REFERENCES template_exercise_alternates(id) ON DELETE SET NULL,
exercise_name TEXT NOT NULL,
muscle_group TEXT,
order_index INTEGER NOT NULL,
status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'completed', 'skipped')),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX idx_gym_exercise_order
ON gym_exercises(session_id, order_index);

CREATE TABLE gym_sets (
id SERIAL PRIMARY KEY,
exercise_id INTEGER NOT NULL REFERENCES gym_exercises(id) ON DELETE CASCADE,
logged_exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
set_number INTEGER NOT NULL CHECK (set_number > 0),
weight NUMERIC(6,2) NOT NULL CHECK (weight >= 0),
reps INTEGER,
rir INTEGER CHECK (rir BETWEEN 0 AND 5),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX idx_gym_set_number
ON gym_sets(exercise_id, set_number);

CREATE INDEX idx_gym_sets_logged_exercise_id
ON gym_sets(logged_exercise_id);

CREATE INDEX idx_gym_exercise_name
ON gym_exercises(exercise_name);

CREATE INDEX idx_template_exercise_name
ON template_exercises(exercise_name);

CREATE INDEX idx_gym_sessions_date
ON gym_sessions(date);
