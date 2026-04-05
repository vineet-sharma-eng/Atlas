const config = require('../../config');
const llmClient = require('../../clients/llm.client');
const logger = require('../../utils/logger');
const {
  validateAdvisorResponse,
  normalizeAdvisorResponse,
  looksLikeStructuredData,
  buildAdvisorFallbackResponse,
} = require('../../utils/responseValidator');
const { ADVISOR_SYSTEM_PROMPT_TEMPLATE, ADVISOR_USER_PROMPT_TEMPLATE } = require('./prompts/advisor.prompt');
const { CONVERSATION_SYSTEM_PROMPT_TEMPLATE, CONVERSATION_USER_PROMPT_TEMPLATE } = require('./prompts/conversation.prompt');

async function generateAdvisorResponse({ queryType, intents, message, context, requestId, tags = [] }) {
  let generationAttempt = 0;
  const totalGenerationAttempts = 2;
  let previousInvalidContent = '';

  while (generationAttempt < totalGenerationAttempts) {
    const prompt = buildAdvisorPrompt({
      queryType,
      intents,
      message,
      context,
      previousInvalidContent,
      generationAttempt,
    });

    try {
      const content = await generateRawText({
        system: ADVISOR_SYSTEM_PROMPT_TEMPLATE,
        prompt,
        requestId,
        tags,
      });

      if (looksLikeStructuredData(content)) {
        generationAttempt += 1;
        previousInvalidContent = String(content || '').trim();

        logger.warn('Advisor response returned structured data instead of plain text', {
          requestId,
          generationAttempt,
          totalGenerationAttempts,
          tags,
          preview: String(content || '').slice(0, 300),
        });
        continue;
      }

      if (validateAdvisorResponse(content)) {
        return normalizeAdvisorResponse(content);
      }

      generationAttempt += 1;
      previousInvalidContent = String(content || '').trim();

      logger.warn('Advisor response failed structure validation', {
        requestId,
        generationAttempt,
        totalGenerationAttempts,
        tags,
        preview: String(content || '').slice(0, 300),
      });
    } catch (error) {
      generationAttempt += 1;

      if (generationAttempt >= totalGenerationAttempts) {
        logger.error('Advisor response generation failed', {
          requestId,
          error: error.message,
          tags,
        });
        return buildAdvisorFallbackResponse({ queryType, intents, context, message });
      }

      logger.warn('Retrying advisor response generation', {
        requestId,
        generationAttempt,
        totalGenerationAttempts,
        error: error.message,
        tags,
      });
    }
  }

  logger.warn('Returning advisor fallback response after invalid outputs', {
    requestId,
    tags,
  });
  return buildAdvisorFallbackResponse({ queryType, intents, context, message });
}

async function generateConversationalResponse({ queryType, message, requestId, tags = [] }) {
  const prompt = CONVERSATION_USER_PROMPT_TEMPLATE
    .replace('{{queryType}}', queryType)
    .replace('{{message}}', String(message || ''));

  return generateRawText({
    system: CONVERSATION_SYSTEM_PROMPT_TEMPLATE,
    prompt,
    requestId,
    tags,
  });
}

async function generateRawText({ system, prompt, requestId, tags = [] }) {
  let attempt = 0;
  const totalAttempts = config.ollama.maxRetries + 1;

  while (attempt < totalAttempts) {
    try {
      return await llmClient.generate({ system, prompt });
    } catch (error) {
      if (isNonRetryable(error)) {
        throw error;
      }

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

function buildAdvisorPrompt({
  queryType,
  intents,
  message,
  context,
  previousInvalidContent = '',
  generationAttempt = 0,
}) {
  const intentLabel = Array.isArray(intents) && intents.length > 0 ? intents.join(', ') : 'none';
  const contextLabel = String(context || '').trim() || '- No structured personal-data context provided.';

  const basePrompt = ADVISOR_USER_PROMPT_TEMPLATE
    .replace('{{queryType}}', queryType)
    .replace('{{intents}}', intentLabel)
    .replace('{{context}}', contextLabel)
    .replace('{{message}}', String(message || ''));

  if (generationAttempt > 0) {
    return [
      basePrompt,
      '',
      'Your previous answer was invalid.',
      'Rewrite it now as plain text only.',
      'Do not return JSON.',
      'Do not return follow-up questions.',
      'Start immediately with: Key Insights:',
      'Then include exactly these headings in order:',
      'Key Insights:',
      "What's Good:",
      'What Needs Improvement:',
      'What You Should Do Next:',
      'Make sure the final section contains 3-5 bullet steps.',
      previousInvalidContent
        ? `Invalid previous output:\n${previousInvalidContent.slice(0, 500)}`
        : '',
    ].filter(Boolean).join('\n');
  }

  return basePrompt;
}

function isNonRetryable(error) {
  const cause = String(error?.details?.cause || error?.message || '').toLowerCase();
  return cause.includes('model') && cause.includes('not found');
}

module.exports = {
  generateAdvisorResponse,
  generateConversationalResponse,
  generateText: generateRawText,
  generateRawText,
};
