const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? payload.error
        : 'Request failed';

    throw new Error(message);
  }

  return payload;
}

export function getGymTemplates() {
  return request('/gym/templates');
}

export function getGymSessionInit(templateId, date) {
  return request(`/gym/session/init/${templateId}?date=${date}`);
}

export function startGymSession({ templateId, date }) {
  return request('/gym/session/start', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      date,
    }),
  });
}

export function addGymExercise({ sessionId, exerciseName, muscleGroup }) {
  return request('/gym/exercise', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      exercise_name: exerciseName,
      muscle_group: muscleGroup,
    }),
  });
}

export function deleteGymExercise(exerciseId) {
  return request(`/gym/exercise/${exerciseId}`, {
    method: 'DELETE',
  });
}

export function skipGymExercise(exerciseId, skipped) {
  return request(`/gym/exercise/${exerciseId}/skip`, {
    method: 'POST',
    body: JSON.stringify({ skipped }),
  });
}

export function createGymSet({ exerciseId, setNumber, weight, reps, rir }) {
  return request('/gym/set', {
    method: 'POST',
    body: JSON.stringify({
      exercise_id: exerciseId,
      set_number: setNumber,
      weight,
      reps,
      rir,
    }),
  });
}

export function addExerciseToTemplate({ templateId, exerciseName, muscleGroup }) {
  return request('/gym/template/exercise/add', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      exercise_name: exerciseName,
      muscle_group: muscleGroup,
    }),
  });
}
