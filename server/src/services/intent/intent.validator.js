const VALID_INTENTS = new Set(['finance', 'gym']);
const VALID_QUERY_TYPES = new Set(['greeting', 'smalltalk', 'question', 'analysis_request']);

function safeParseClassification(rawValue) {
  try {
    return JSON.parse(String(rawValue || '').trim());
  } catch (_) {
    return null;
  }
}

function validateClassification(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  if (!Array.isArray(candidate.intents)) {
    return null;
  }

  if (typeof candidate.queryType !== 'string' || !VALID_QUERY_TYPES.has(candidate.queryType)) {
    return null;
  }

  if (!candidate.intents.every((intent) => typeof intent === 'string')) {
    return null;
  }

  const normalizedIntents = Array.from(
    new Set(
      candidate.intents
        .map((intent) => intent.trim().toLowerCase())
        .filter((intent) => VALID_INTENTS.has(intent)),
    ),
  );

  if (normalizedIntents.length !== candidate.intents.length) {
    return null;
  }

  return normalizeClassificationSemantics({
    intents: normalizedIntents,
    queryType: candidate.queryType,
  });
}

function applySafetyOverride(classification) {
  if (classification.queryType === 'analysis_request' && classification.intents.length === 0) {
    return {
      intents: ['finance', 'gym'],
      queryType: classification.queryType,
    };
  }

  return classification;
}

function normalizeClassificationSemantics(classification) {
  if (classification.queryType === 'greeting' || classification.queryType === 'smalltalk') {
    return {
      intents: [],
      queryType: classification.queryType,
    };
  }

  if (classification.queryType === 'question' && classification.intents.length > 0) {
    return {
      intents: [],
      queryType: 'question',
    };
  }

  return classification;
}

module.exports = {
  VALID_INTENTS,
  VALID_QUERY_TYPES,
  safeParseClassification,
  validateClassification,
  applySafetyOverride,
  normalizeClassificationSemantics,
};
