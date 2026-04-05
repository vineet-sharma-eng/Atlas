const { Ollama } = require('ollama');

const config = require('../config');
const ollamaClient = require('./ollama.client');

async function generate({ system, prompt }) {
  return ollamaClient.generate({ system, prompt });
}

async function checkLocalModelAvailable() {
  const client = new Ollama({ host: config.ollama.baseUrl });

  try {
    const tags = await client.list();
    const models = Array.isArray(tags?.models) ? tags.models : [];
    return models.some((model) => model.model === config.ollama.model || model.name === config.ollama.model);
  } catch (_) {
    return false;
  }
}

module.exports = {
  generate,
  checkLocalModelAvailable,
};
