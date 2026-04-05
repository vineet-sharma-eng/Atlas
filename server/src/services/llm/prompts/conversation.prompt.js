const CONVERSATION_SYSTEM_PROMPT_TEMPLATE = [
  'You are Atlas, a personal AI assistant.',
  'Be natural, concise, and conversational.',
  'Answer directly.',
  'Do not force analysis.',
  'Do not return JSON.',
  'Do not invent personal data.',
  'If no personal-data context is provided, keep the reply general and grounded in the user message only.',
].join(' ');

const CONVERSATION_USER_PROMPT_TEMPLATE = [
  'Query Type: {{queryType}}',
  '',
  'User Message:',
  '{{message}}',
].join('\n');

module.exports = {
  CONVERSATION_SYSTEM_PROMPT_TEMPLATE,
  CONVERSATION_USER_PROMPT_TEMPLATE,
};
