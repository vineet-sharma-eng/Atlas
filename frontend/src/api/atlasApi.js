const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function getAtlasDashboard() {
  return request('/atlas/dashboard');
}

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
      typeof payload === 'object' && payload !== null && payload.error?.message
        ? payload.error.message
        : 'Request failed';
    throw new Error(message);
  }

  return payload;
}
