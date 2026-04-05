const INTENT_CLASSIFIER_SYSTEM_PROMPT = 'You are a strict intent classifier. Output JSON only. No explanations.';

const INTENT_CLASSIFIER_USER_PROMPT_TEMPLATE = [
  'Classify the user message for a personal AI assistant.',
  'Return valid JSON only in this exact shape:',
  '{"intents":["finance","gym"],"queryType":"greeting|smalltalk|question|analysis_request"}',
  'Rules:',
  '- intents must be an array containing zero or more of: finance, gym',
  '- If finance and gym are both relevant, include both',
  '- If neither is relevant, return an empty array []',
  '- queryType must be exactly one of: greeting, smalltalk, question, analysis_request',
  '- greeting: hi, hello, hey, basic greeting only',
  '- smalltalk: casual conversational message that is not asking for personal data analysis',
  '- question: general informational question without asking about the user\'s own data',
  '- analysis_request: user is asking for insight, summary, recommendation, status, trend, or interpretation using their own finance or gym data',
  '- Do not return markdown',
  '- Do not return explanations',
  'User message:',
  '{{message}}',
].join('\n');

module.exports = {
  INTENT_CLASSIFIER_SYSTEM_PROMPT,
  INTENT_CLASSIFIER_USER_PROMPT_TEMPLATE,
};
