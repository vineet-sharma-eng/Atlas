const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env'), override: false });

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOrigins(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const port = parseInteger(process.env.PORT, 5001);
const config = {
  env: process.env.NODE_ENV || 'development',
  port,
  isProduction: process.env.NODE_ENV === 'production',
  appName: process.env.APP_NAME || 'Atlas Orchestrator',
  openAiModelId: process.env.ATLAS_OPENAI_MODEL_ID || 'atlas',
  frontendDistPath: path.resolve(__dirname, '..', '..', '..', 'frontend', 'dist'),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    generatePath: process.env.OLLAMA_GENERATE_PATH || '/api/generate',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    timeoutMs: parseInteger(process.env.OLLAMA_TIMEOUT_MS, 30000),
    maxRetries: parseInteger(process.env.OLLAMA_MAX_RETRIES, 1),
  },
  api: {
    baseUrl: process.env.ATLAS_INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`,
    timeoutMs: parseInteger(process.env.ATLAS_INTERNAL_API_TIMEOUT_MS, 5000),
  },
  server: {
    jsonLimit: process.env.JSON_BODY_LIMIT || '1mb',
    corsAllowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
  },
};

module.exports = config;
