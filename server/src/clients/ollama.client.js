const config = require('../config');
const { AppError } = require('../utils/errorHandler');

async function generate({ prompt, system }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);

  try {
    const response = await fetch(
      `${config.ollama.baseUrl.replace(/\/$/, '')}${config.ollama.generatePath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: config.ollama.model,
          prompt,
          system,
          stream: false,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const payload = await safeJson(response);
      throw new AppError('Ollama request failed', 502, {
        status: response.status,
        response: payload,
      });
    }

    const payload = await safeJson(response);
    const text = String(payload.response || '').trim();

    if (!text) {
      throw new AppError('Ollama returned an empty response', 502);
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('Ollama request timed out', 504);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Ollama request failed', 502, {
      cause: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text };
  }
}

module.exports = {
  generate,
};
