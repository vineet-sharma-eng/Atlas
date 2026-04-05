const financeService = require('../modules/finance/finance.service');
const gymService = require('../modules/gym/gym.service');
const contextService = require('./context.service');
const intentService = require('./intent.service');
const llmService = require('./llm.service');
const logger = require('../utils/logger');

async function orchestrateChat({ message, requestId }) {
  const classification = await intentService.classifyMessage(message, { requestId });
  const fetchPlan = buildFetchPlan({ message, classification });

  let financeAnalysis = null;
  let gymAnalysis = null;

  if (fetchPlan.finance) {
    financeAnalysis = await safeFetch(financeService.getFinanceAnalysis, 'finance', requestId);
  }

  if (fetchPlan.gym) {
    gymAnalysis = await safeFetch(gymService.getGymAnalysis, 'gym', requestId);
  }

  const context = isAnalysisRequest(classification)
    ? contextService.buildContext({
        intents: classification.intents,
        queryType: classification.queryType,
        financeAnalysis,
        gymAnalysis,
        message,
      })
    : '';

  const content = isAnalysisRequest(classification)
    ? await llmService.generateAdvisorResponse({
        queryType: classification.queryType,
        intents: classification.intents,
        message,
        context,
        requestId,
        tags: ['chat-response', classification.queryType, ...classification.intents],
      })
    : await llmService.generateConversationalResponse({
        queryType: classification.queryType,
        message,
        requestId,
        tags: ['chat-response', classification.queryType],
      });

  return {
    ...classification,
    context,
    content,
  };
}

function buildFetchPlan({ message, classification }) {
  if (classification.queryType === 'greeting' || classification.queryType === 'smalltalk') {
    return { finance: false, gym: false };
  }

  if (classification.queryType === 'question') {
    return { finance: false, gym: false };
  }

  if (classification.queryType !== 'analysis_request') {
    return { finance: false, gym: false };
  }

  return {
    finance: classification.intents.includes('finance'),
    gym: classification.intents.includes('gym'),
  };
}

function isAnalysisRequest(classification) {
  return classification.queryType === 'analysis_request';
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
