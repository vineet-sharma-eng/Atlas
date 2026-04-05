const { applySafetyOverride, normalizeClassificationSemantics } = require('./intent.validator');

const FINANCE_KEYWORDS = /\b(spend|spending|money|expense|expenses|budget|transaction|transactions|finance|financial)\b/i;
const GYM_KEYWORDS = /\b(gym|workout|workouts|exercise|exercises|lift|lifting|weight|weights|training|fitness|strength)\b/i;
const GREETING_KEYWORDS = /^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b[!. ]*$/i;
const SMALLTALK_KEYWORDS = /^(how are you|what's up|whats up|how's it going|hows it going|nice to meet you|thanks|thank you)\b/i;
const ANALYSIS_KEYWORDS = /\b(my|mine|me|analy[sz]e|analysis|summary|summarize|insight|insights|trend|trends|progress|status|how am i doing|how's my|hows my|review|recommend)\b/i;

function classifyWithFallback(message) {
  const normalizedMessage = String(message || '').trim();
  const loweredMessage = normalizedMessage.toLowerCase();

  const intents = [];

  if (FINANCE_KEYWORDS.test(loweredMessage)) {
    intents.push('finance');
  }

  if (GYM_KEYWORDS.test(loweredMessage)) {
    intents.push('gym');
  }

  let queryType = 'question';

  if (GREETING_KEYWORDS.test(normalizedMessage)) {
    queryType = 'greeting';
  } else if (SMALLTALK_KEYWORDS.test(normalizedMessage)) {
    queryType = 'smalltalk';
  } else if (ANALYSIS_KEYWORDS.test(loweredMessage) || (intents.length > 0 && /\b(my|mine|me)\b/i.test(normalizedMessage))) {
    queryType = 'analysis_request';
  }

  return applySafetyOverride(
    normalizeClassificationSemantics({
      intents: Array.from(new Set(intents)),
      queryType,
    }),
  );
}

module.exports = {
  classifyWithFallback,
};
