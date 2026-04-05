const config = require('../config');
const { AppError } = require('../utils/errorHandler');

async function request(pathname, { method = 'GET', headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.api.timeoutMs);

  try {
    const response = await fetch(`${config.api.baseUrl}${pathname}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      throw new AppError(`Internal API request failed for ${pathname}`, 502, {
        status: response.status,
        response: errorPayload,
      });
    }

    return safeJson(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(`Internal API timeout for ${pathname}`, 504);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`Internal API request error for ${pathname}`, 502, {
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
  request,
};
