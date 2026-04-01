const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const userTimeZone = getUserTimeZone();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Timezone': userTimeZone,
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
    const error = new Error(message);

    if (typeof payload === 'object' && payload !== null) {
      error.data = payload;
    }

    throw error;
  }

  return payload;
}

export function getGymTemplates() {
  return request('/gym/templates');
}

export function getGymExercises(search = '', limit = 50) {
  const params = new URLSearchParams();

  if (search) {
    params.set('search', search);
  }

  params.set('limit', String(limit));
  return request(`/gym/exercises?${params.toString()}`);
}

export function getRecentGymExercises(limit = 12) {
  const params = new URLSearchParams({ limit: String(limit) });
  return request(`/gym/exercises/recent?${params.toString()}`);
}

export function updateGymTemplateName(templateId, name) {
  return request(`/gym/template/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function renameGymExercise(exerciseId, payload) {
  return request(`/gym/exercises/${exerciseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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

export function startGymSession({ templateId }) {
  return request('/gym/session/start', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
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

export function deleteGymSessionHistory(sessionId) {
  return request(`/gym/session/${sessionId}`, {
    method: 'DELETE',
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

export function deleteGymSessionExerciseHistory(sessionExerciseId) {
  return request(`/gym/session-exercise/${sessionExerciseId}`, {
    method: 'DELETE',
  });
}

export function updateGymExerciseStatus(exerciseId, status) {
  return request(`/gym/exercise/${exerciseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateGymSessionExerciseOverride(sessionExerciseId, payload) {
  return request(`/gym/session-exercise/${sessionExerciseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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

export function getGymTemplateExerciseAlternates(templateExerciseId) {
  return request(`/gym/template/exercise/${templateExerciseId}/alternates`);
}

export function createGymTemplateExerciseAlternate(templateExerciseId, payload) {
  return request(`/gym/template/exercise/${templateExerciseId}/alternates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getGymExerciseHistory(exerciseId, { beforeDate, templateId, limit = 3 } = {}) {
  const params = new URLSearchParams();

  if (beforeDate) {
    params.set('before_date', beforeDate);
  }

  if (templateId) {
    params.set('template_id', String(templateId));
  }

  params.set('limit', String(limit));
  return request(`/gym/exercises/${exerciseId}/history?${params.toString()}`);
}

export function getGymExerciseProgress(exerciseId, { beforeDate, templateId, limit = 3 } = {}) {
  const params = new URLSearchParams();

  if (beforeDate) {
    params.set('before_date', beforeDate);
  }

  if (templateId) {
    params.set('template_id', String(templateId));
  }

  params.set('limit', String(limit));
  return request(`/gym/exercises/${exerciseId}/progress?${params.toString()}`);
}

function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}
