const llmService = require('../llm.service');
const logger = require('../../utils/logger');
const { INTENT_CLASSIFIER_SYSTEM_PROMPT, INTENT_CLASSIFIER_USER_PROMPT_TEMPLATE } = require('./intent.prompt');
const { safeParseClassification, validateClassification, applySafetyOverride } = require('./intent.validator');
const { classifyWithFallback } = require('./intent.fallback');

async function classifyMessage(message, { requestId } = {}) {
  const prompt = INTENT_CLASSIFIER_USER_PROMPT_TEMPLATE.replace('{{message}}', String(message || ''));

  try {
    const rawResult = await llmService.generateText({
      system: INTENT_CLASSIFIER_SYSTEM_PROMPT,
      prompt,
      requestId,
      tags: ['intent-classification'],
    });

    const parsedResult = safeParseClassification(rawResult);
    const validatedResult = validateClassification(parsedResult);

    if (validatedResult) {
      return applySafetyOverride(validatedResult);
    }

    logger.warn('Intent classification validation failed, using fallback', {
      requestId,
      rawResult,
    });
  } catch (error) {
    logger.warn('Intent classification LLM failed, using fallback', {
      requestId,
      error: error.message,
    });
  }

  return classifyWithFallback(message);
}

module.exports = {
  classifyMessage,
};
