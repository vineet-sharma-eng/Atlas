const config = require('../../config');

async function checkCloudAvailable() {
  if (!config.cloud.motivationApiKey || !config.cloud.motivationModel) {
    return false;
  }

  try {
    const response = await callCloudProvider('Generate one short motivation line.');
    return Array.isArray(response) && response.length > 0;
  } catch (_) {
    return false;
  }
}

async function generateMotivationBatch(batchSize) {
  return callCloudProvider(`Generate ${batchSize} short motivational lines.`);
}

async function callCloudProvider(userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.cloud.timeoutMs);

  try {
    const response = await fetch(config.cloud.motivationApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.cloud.motivationApiKey}`,
        'HTTP-Referer': 'https://atlas.local',
        'X-Title': 'Atlas Motivation',
      },
      body: JSON.stringify({
        model: config.cloud.motivationModel,
        messages: [
          {
            role: 'system',
            content: 'Return JSON only as an array of short motivational lines. Max 10 words each. Practical tone. No cliches. No repetition.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 256,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Cloud motivation provider failed with status ${response.status}`);
    }

    const payload = await response.json();
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  checkCloudAvailable,
  generateMotivationBatch,
};
