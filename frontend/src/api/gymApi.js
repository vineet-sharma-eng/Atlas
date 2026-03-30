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

export function updateGymTemplateName(templateId, name) {
  return request(`/gym/template/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function toggleGymTemplateExercise(templateExerciseId) {
  return request(`/gym/template/exercise/${templateExerciseId}/toggle`, {
    method: 'PATCH',
  });
}

export function reorderGymTemplate(templateId, exercises) {
  return request(`/gym/template/${templateId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ exercises }),
  });
}

export function updateGymTemplateSet(templateSetId, payload) {
  return request(`/gym/template/set/${templateSetId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function duplicateGymTemplate(templateId) {
  return request(`/gym/template/${templateId}/duplicate`, {
    method: 'POST',
  });
}

export function getActiveGymSession() {
  return request('/gym/session/active');
}

export function getGymSessionInit(templateId) {
  return request(`/gym/session/init/${templateId}`);
}

export function getGymSessions() {
  return request('/gym/sessions');
}

export function getGymSessionDetail(sessionId) {
  return request(`/gym/session/${sessionId}`);
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

export function endGymSession(sessionId) {
  return request('/gym/session/end', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
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

export function updateGymExerciseStatus(exerciseId, status) {
  return request(`/gym/exercise/${exerciseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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

export function getGymExerciseHistory(exerciseName) {
  return request(`/gym/exercise/${encodeURIComponent(exerciseName)}/history`);
}

export function getGymExerciseProgress(exerciseName) {
  return request(`/gym/exercise/${encodeURIComponent(exerciseName)}/progress`);
}
