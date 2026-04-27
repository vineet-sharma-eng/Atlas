const llmClient = require('../../clients/llm.client');

async function checkLocalAvailable() {
  return llmClient.checkLocalModelAvailable();
}

async function generateMotivationBatch(batchSize) {
  const raw = await llmClient.generate({
    system: 'You generate concise motivational lines for Atlas. Output JSON only.',
    prompt: [
      `Create ${batchSize} short motivational lines for Atlas.`,
      'Return JSON only as an array of strings.',
      'Each line must be practical, specific, and no more than 10 words.',
      'Avoid cliches, repetition, hashtags, and quotation marks.',
    ].join('\n\n'),
  });

  return parseJsonArray(raw)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, batchSize);
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(String(raw || '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

module.exports = {
  checkLocalAvailable,
  generateMotivationBatch,
};
