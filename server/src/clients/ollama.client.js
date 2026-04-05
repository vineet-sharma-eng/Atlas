const { Ollama } = require('ollama');

const config = require('../config');
const { AppError } = require('../utils/errorHandler');

const ollama = new Ollama({
  host: config.ollama.baseUrl,
  fetch: createTimedFetch(config.ollama.timeoutMs),
});

async function generate({ prompt, system }) {
  try {
    const payload = await ollama.generate({
      model: config.ollama.model,
      prompt,
      system,
      stream: false,
    });
    const text = String(payload.response || '').trim();

    if (!text) {
      throw new AppError('Ollama returned an empty response', 502);
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError' || /timed out/i.test(error.message || '')) {
      throw new AppError('Ollama request timed out', 504);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Ollama request failed', 502, {
      cause: error.message,
    });
  }
}

function createTimedFetch(timeoutMs) {
  return async function timedFetch(input, init = {}) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
    const relayAbort = () => timeoutController.abort();

    if (init.signal) {
      if (init.signal.aborted) {
        timeoutController.abort();
      } else {
        init.signal.addEventListener('abort', relayAbort, { once: true });
      }
    }

    try {
      return await fetch(input, {
        ...init,
        signal: timeoutController.signal,
      });
    } finally {
      clearTimeout(timeout);
      if (init.signal) {
        init.signal.removeEventListener('abort', relayAbort);
      }
    }
  };
}

module.exports = {
  generate,
};
