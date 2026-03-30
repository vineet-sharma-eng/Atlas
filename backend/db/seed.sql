INSERT INTO workout_templates (id, name, day, day_order) VALUES
(1, 'Chest + Triceps (Strength)', 'Monday', 1),
(2, 'Back + Biceps', 'Tuesday', 2),
(3, 'Legs + Shoulders (Moderate)', 'Wednesday', 3),
(4, 'Chest + Triceps (Hypertrophy)', 'Thursday', 4),
(5, 'Back + Biceps (Variation)', 'Friday', 5),
(6, 'Legs + Shoulders (Light)', 'Saturday', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_exercises (id, template_id, exercise_name, muscle_group, order_index) VALUES

-- Monday
(1, 1, 'dumbbell_bench_press', 'chest', 1),
(2, 1, 'incline_dumbbell_press', 'chest', 2),
(3, 1, 'cable_fly', 'chest', 3),
(4, 1, 'rope_triceps_pushdown', 'triceps', 4),
(5, 1, 'overhead_triceps_extension', 'triceps', 5),

-- Tuesday
(6, 2, 'lat_pulldown', 'back', 1),
(7, 2, 'machine_row', 'back', 2),
(8, 2, 'seated_cable_row', 'back', 3),
(9, 2, 'face_pull', 'rear_delts', 4),
(10, 2, 'dumbbell_curl', 'biceps', 5),
(11, 2, 'hammer_curl', 'biceps', 6),

-- Wednesday
(12, 3, 'goblet_squat', 'legs', 1),
(13, 3, 'romanian_deadlift_db', 'legs', 2),
(14, 3, 'leg_press', 'legs', 3),
(15, 3, 'db_shoulder_press', 'shoulders', 4),
(16, 3, 'lateral_raise', 'shoulders', 5),
(17, 3, 'standing_calf_raise', 'calves', 6),

-- Thursday
(18, 4, 'incline_dumbbell_press', 'chest', 1),
(19, 4, 'flat_machine_press', 'chest', 2),
(20, 4, 'cable_fly', 'chest', 3),
(21, 4, 'bench_dips', 'triceps', 4),
(22, 4, 'triceps_pushdown', 'triceps', 5),

-- Friday
(23, 5, 'pull_ups', 'back', 1),
(24, 5, 'one_arm_db_row', 'back', 2),
(25, 5, 'rear_delt_fly', 'rear_delts', 3),
(26, 5, 'incline_db_curl', 'biceps', 4),
(27, 5, 'hammer_curl', 'biceps', 5),

-- Saturday
(28, 6, 'hack_squat', 'legs', 1),
(29, 6, 'bulgarian_split_squat', 'legs', 2),
(30, 6, 'leg_curl', 'legs', 3),
(31, 6, 'lateral_raise', 'shoulders', 4),
(32, 6, 'seated_calf_raise', 'calves', 5),
(33, 6, 'plank', 'core', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_sets (template_exercise_id, target_sets, rep_min, rep_max, notes) VALUES

-- Monday
(1, 4, 6, 8, 'RIR 1-2'),
(2, 3, 8, 10, NULL),
(3, 3, 12, 15, NULL),
(4, 3, 10, 12, NULL),
(5, 2, 12, 12, NULL),

-- Tuesday
(6, 4, 8, 10, NULL),
(7, 4, 8, 10, NULL),
(8, 3, 12, 12, NULL),
(9, 3, 15, 15, NULL),
(10, 3, 10, 12, NULL),
(11, 2, 12, 12, NULL),

-- Wednesday
(12, 3, 8, 10, NULL),
(13, 3, 10, 10, NULL),
(14, 3, 10, 12, NULL),
(15, 3, 8, 10, NULL),
(16, 3, 12, 15, NULL),
(17, 3, 15, 15, NULL),

-- Thursday
(18, 4, 8, 10, NULL),
(19, 3, 10, 10, NULL),
(20, 3, 15, 15, NULL),
(21, 3, NULL, NULL, 'AMRAP'),
(22, 2, 12, 12, NULL),

-- Friday
(23, 4, 8, 8, NULL),
(24, 4, 8, 10, NULL),
(25, 3, 15, 15, NULL),
(26, 3, 12, 12, NULL),
(27, 2, 12, 12, NULL),

-- Saturday
(28, 3, 8, 8, NULL),
(29, 2, 8, 8, 'per leg'),
(30, 3, 12, 12, NULL),
(31, 4, 15, 15, NULL),
(32, 3, 15, 15, NULL),
(33, 3, NULL, NULL, '45-60 sec')
ON CONFLICT DO NOTHING;
