export function formatExerciseName(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return 'Exercise';
  }

  if (!trimmed.includes('_')) {
    return trimmed;
  }

  return trimmed
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function parseLocalDate(dateValue) {
  const candidate = String(dateValue || '').trim();

  if (!candidate) {
    return null;
  }

  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatLocalDate(dateValue, options = {}) {
  const parsed = parseLocalDate(dateValue);

  if (!parsed) {
    return '--';
  }

  return parsed.toLocaleDateString(undefined, options);
}
