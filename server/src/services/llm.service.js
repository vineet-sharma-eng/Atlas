const config = require('../config');
const ollamaClient = require('../clients/ollama.client');
const logger = require('../utils/logger');

async function generateText({ system, prompt, requestId, tags = [] }) {
  let attempt = 0;
  const totalAttempts = config.ollama.maxRetries + 1;

  while (attempt < totalAttempts) {
    try {
      return await ollamaClient.generate({ system, prompt });
    } catch (error) {
      attempt += 1;

      if (attempt >= totalAttempts) {
        throw error;
      }

      logger.warn('Retrying Ollama request', {
        requestId,
        attempt,
        totalAttempts,
        tags,
        error: error.message,
      });
    }
  }

  throw new Error('Unexpected LLM retry flow');
}

module.exports = {
  generateText,
};
