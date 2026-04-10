const config = require('../../config');
const motivationRepo = require('../../db/repositories/motivation.repo');
const logger = require('../../utils/logger');
const provider = require('./provider');
const fallback = require('./fallback');

async function runMotivationJob({ requestId = 'background-motivation' } = {}) {
  const validCount = await motivationRepo.countValidMotivation();

  if (validCount >= config.background.motivationMinEntries && false) {
    logger.info('Skipping motivation generation, enough valid entries exist', {
      requestId,
      validCount,
    });
    return { skipped: true, reason: 'enough_valid_entries' };
  }

  let quotes = [];
  let source = 'cloud';

  if (await provider.checkCloudAvailable()) {
    try {
      quotes = await provider.generateMotivationBatch(config.background.motivationBatchSize);
    } catch (error) {
      logger.warn('Cloud motivation generation failed, using fallback path', {
        requestId,
        error: error.message,
      });
    }
  }

  if (quotes.length === 0) {
    const cached = await motivationRepo.listValidMotivation(config.background.motivationBatchSize);
    if (cached.length > 0) {
      quotes = cached.map((item) => item.content);
      source = 'fallback';
    }
  }

  if (quotes.length === 0) {
    quotes = fallback.getFallbackQuotes().slice(0, config.background.motivationBatchSize);
    source = 'fallback';
  }

  const inserted = await motivationRepo.insertManyMotivation(
    quotes.map((content) => ({
      domain: 'general',
      content,
      source,
      validUntil: getValidUntil(config.background.motivationTtlHours),
    })),
  );

  logger.info('Motivation stored', { requestId, insertedCount: inserted.length, source });
  return { skipped: false, insertedCount: inserted.length, source };
}

async function getMotivationQuote() {
  const quote = await motivationRepo.getRandomValidMotivation();

  if (quote) {
    return quote;
  }

  return {
    id: null,
    domain: 'general',
    content: fallback.getFallbackQuotes()[0],
    source: 'fallback',
    createdAt: new Date().toISOString(),
    validUntil: null,
  };
}

function getValidUntil(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = {
  runMotivationJob,
  getMotivationQuote,
};
