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
  const configuredOrigins = [];

  if (process.env.RENDER_EXTERNAL_URL) {
    configuredOrigins.push(String(process.env.RENDER_EXTERNAL_URL).trim());
  }

  if (process.env.APP_BASE_URL) {
    configuredOrigins.push(String(process.env.APP_BASE_URL).trim());
  }

  if (!raw) {
    return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins.filter(Boolean)])];
  }

  return [
    ...new Set([
      ...raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ...configuredOrigins.filter(Boolean),
    ]),
  ];
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
    model: process.env.OLLAMA_MODEL || 'llama3:latest',
    timeoutMs: parseInteger(process.env.OLLAMA_TIMEOUT_MS, 30000),
    maxRetries: parseInteger(process.env.OLLAMA_MAX_RETRIES, 1),
  },
  api: {
    baseUrl: process.env.ATLAS_INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`,
    timeoutMs: parseInteger(process.env.ATLAS_INTERNAL_API_TIMEOUT_MS, 5000),
  },
  background: {
    financeInsightsSchedule: process.env.FINANCE_INSIGHTS_CRON || '0 9 * * 0',
    gymInsightsSchedule: process.env.GYM_INSIGHTS_CRON || '0 8 */2 * *',
    financeTipsSchedule: process.env.FINANCE_TIPS_CRON || '0 7 * * 1,4',
    gymTipsSchedule: process.env.GYM_TIPS_CRON || '0 7 */2 * *',
    motivationSchedule: process.env.MOTIVATION_CRON || '0 7 * * *',
    financeInsightsTtlHours: parseInteger(process.env.FINANCE_INSIGHTS_TTL_HOURS, 168),
    gymInsightsTtlHours: parseInteger(process.env.GYM_INSIGHTS_TTL_HOURS, 48),
    tipsTtlHours: parseInteger(process.env.TIPS_TTL_HOURS, 48),
    motivationTtlHours: parseInteger(process.env.MOTIVATION_TTL_HOURS, 24),
    financeInsightsMinEntries: parseInteger(process.env.FINANCE_INSIGHTS_MIN_ENTRIES, 3),
    gymInsightsMinEntries: parseInteger(process.env.GYM_INSIGHTS_MIN_ENTRIES, 3),
    tipsMinEntries: parseInteger(process.env.TIPS_MIN_ENTRIES, 5),
    motivationMinEntries: parseInteger(process.env.MOTIVATION_MIN_ENTRIES, 7),
    motivationBatchSize: parseInteger(process.env.MOTIVATION_BATCH_SIZE, 7),
  },
  cloud: {
    motivationApiUrl: process.env.MOTIVATION_CLOUD_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    motivationApiKey: process.env.MOTIVATION_CLOUD_API_KEY || '',
    motivationModel: process.env.MOTIVATION_CLOUD_MODEL || '',
    timeoutMs: parseInteger(process.env.MOTIVATION_CLOUD_TIMEOUT_MS, 12000),
  },
  server: {
    jsonLimit: process.env.JSON_BODY_LIMIT || '1mb',
    corsAllowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
  },
};

module.exports = config;
