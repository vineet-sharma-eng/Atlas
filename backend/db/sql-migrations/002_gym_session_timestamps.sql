ALTER TABLE gym_sessions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE gym_sessions
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

UPDATE gym_sessions
SET started_at = created_at
WHERE started_at IS NULL;

UPDATE gym_sessions
SET ended_at = updated_at
WHERE ended_at IS NULL
  AND status IN ('completed', 'abandoned');

ALTER TABLE gym_sessions
  ALTER COLUMN started_at SET DEFAULT NOW();

ALTER TABLE gym_sessions
  ALTER COLUMN started_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gym_sessions_started_at
ON gym_sessions (started_at DESC);
