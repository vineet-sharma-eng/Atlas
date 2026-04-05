const financeService = require('../modules/finance/finance.service');
const gymService = require('../modules/gym/gym.service');
const contextService = require('./context.service');
const intentService = require('./intent.service');
const llmService = require('./llm.service');
const logger = require('../utils/logger');

async function orchestrateChat({ message, requestId }) {
  const intent = await intentService.classifyIntent(message, { requestId });

  let financeAnalysis = null;
  let gymAnalysis = null;

  if (intent === 'finance') {
    financeAnalysis = await safeFetch(financeService.getFinanceAnalysis, 'finance', requestId);
  } else if (intent === 'gym') {
    gymAnalysis = await safeFetch(gymService.getGymAnalysis, 'gym', requestId);
  } else {
    [financeAnalysis, gymAnalysis] = await Promise.all([
      safeFetch(financeService.getFinanceAnalysis, 'finance', requestId),
      safeFetch(gymService.getGymAnalysis, 'gym', requestId),
    ]);
  }

  const context = contextService.buildContext({
    intent,
    financeAnalysis,
    gymAnalysis,
  });

  const prompt = [
    'Context:',
    context,
    '',
    'User query:',
    message,
    '',
    'Respond concisely with direct, actionable analysis grounded in the context.',
  ].join('\n');

  const content = await llmService.generateText({
    system: 'You are a personal data analyst. Use ONLY provided context.',
    prompt,
    requestId,
    tags: ['chat-response', intent],
  });

  return {
    intent,
    context,
    content,
  };
}

async function safeFetch(fn, domain, requestId) {
  try {
    return await fn();
  } catch (error) {
    logger.warn('Context source unavailable', {
      requestId,
      domain,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  orchestrateChat,
};
