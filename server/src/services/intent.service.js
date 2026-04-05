const llmService = require('./llm.service');

const ALLOWED_INTENTS = new Set(['finance', 'gym', 'general']);

async function classifyIntent(message, { requestId } = {}) {
  const prompt = [
    'Classify the user intent for a personal AI assistant.',
    'Return exactly one word from this list and nothing else:',
    'finance',
    'gym',
    'general',
    '',
    `User message: """${message}"""`,
  ].join('\n');

  const rawResult = await llmService.generateText({
    system: 'You are an intent classifier. Output exactly one label and no explanation.',
    prompt,
    requestId,
    tags: ['intent-classification'],
  });

  const normalized = String(rawResult || '').trim().toLowerCase().split(/\s+/)[0];
  return ALLOWED_INTENTS.has(normalized) ? normalized : 'general';
}

module.exports = {
  classifyIntent,
};
