# Atlas Gym Exercise Planning Upgrade

## Summary
- Fix history to be canonical-exercise based, using `gym_sets.logged_exercise_id` as the source of truth so the same exercise shows the same progress across templates and sessions.
- Add exercise-level notes with the “latest pinned” model: notes belong to the catalog exercise, and the pinned/latest note follows that exercise everywhere.
- Redesign add/configure flows so users can set exercise, muscle group, target sets, rep range, and target RIR at creation time.
- Support three intentional target scopes: current session only, current template slot for future sessions, and explicit promotion to exercise defaults.
- Upgrade alternates so each alternate can have its own sets/reps/RIR and history follows the currently selected exercise.

## Key Changes
- Add a migration for `exercise_notes`, exercise-level default target fields, session exercise target snapshots, template target RIR, and alternate target overrides.
- Snapshot target fields onto `gym_exercises` when a session starts or when a custom session exercise is added. Current-session extra sets update this snapshot only.
- Keep `template_sets` as the default source for future sessions in that template slot. Add an explicit “Save to future sessions” action that updates the template slot.
- Add explicit “Use as exercise default” action for global exercise defaults; these defaults are only used when creating new custom exercises/slots without a template target.
- Change session init/prefill/history loading to query recent sets by `logged_exercise_id` across all templates, excluding the current local day for normal history.
- Add a separate same-day usage signal per template slot/effective exercise so the UI can show “Earlier today you used X here” without mixing it into previous-history prefill.
- Store alternate target overrides on `template_exercise_alternates`; if an alternate has no override, it inherits the base slot targets. Swapping alternates refreshes rows and history for the selected exercise.
- Show pinned exercise note, recent history, same-day alternate usage, target controls, and set rows inside the exercise accordion without treating template-set notes as exercise notes.

## API And UI Contract
- Add note endpoints:
  - `GET /gym/exercises/:id/notes`
  - `POST /gym/exercises/:id/notes`
  - `PATCH /gym/exercises/:id/notes/:noteId`
  - `DELETE /gym/exercises/:id/notes/:noteId`
- Extend existing exercise/template endpoints to accept/return `target_sets`, `rep_min`, `rep_max`, and `target_rir`.
- Add `PATCH /gym/session-exercise/:id/targets` for today-only target changes.
- Add alternate update/delete endpoints so users can edit configured alternate targets after creation.
- Redesign “Add exercise” as a bottom-sheet picker with catalog search, recent suggestions, custom entry, target steppers/inputs, target RIR, and clear actions for “Add today” and “Add to future template”.
- Add an exercise notes sheet from each exercise row: pinned note visible inline, all notes editable/deletable, newest note becomes pinned by default.
- In history and session detail panels, remove template-scoped history calls unless the user explicitly filters by template in a future analytics view.

## Test Plan
- Migration verification: fresh `yarn db:setup` and seeded setup both create/backfill new columns and note tables.
- Backend verification: add/edit/delete notes; create session exercise with targets; update today-only targets; save future template targets; promote exercise defaults; create/swap alternates with custom targets.
- History verification: same exercise in two templates shows shared prior history; alternate history follows selected alternate; previously logged sets remain labeled with their original logged exercise after a swap.
- UI verification: `yarn build`, then manual workout flow on desktop/mobile widths covering add exercise, extra set today, save to future, notes CRUD, alternate configuration, and same-day alternate banner.
- Regression checks: completed sessions remain locked, existing template editor still saves set/rep targets, existing session history remains readable.

## Assumptions
- “Exercise notes” means multiple catalog-level notes with one pinned/latest note emphasized during workouts.
- Focused V1 attributes are exercise, muscle group, target sets, rep range, target RIR, and pinned note.
- Future target changes default to the template slot; global exercise defaults require an extra explicit user action.
- Template-set `notes` remain lightweight training instructions such as AMRAP or time-based cues, separate from exercise notes.
