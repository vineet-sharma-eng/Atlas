const REQUIRED_SECTIONS = [
  'Key Insights:',
  "What's Good:",
  'What Needs Improvement:',
  'What You Should Do Next:',
];

function validateAdvisorResponse(content) {
  const text = normalizeAdvisorResponse(content);

  if (!text) {
    return false;
  }

  const sectionIndexes = REQUIRED_SECTIONS.map((section) => text.indexOf(section));

  if (sectionIndexes.some((index) => index === -1)) {
    return false;
  }

  for (let index = 1; index < sectionIndexes.length; index += 1) {
    if (sectionIndexes[index] <= sectionIndexes[index - 1]) {
      return false;
    }
  }

  const actionSection = text.split('What You Should Do Next:')[1] || '';
  const actionItems = actionSection
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]|\d+\./.test(line));

  return actionItems.length >= 3;
}

function looksLikeStructuredData(content) {
  const text = String(content || '').trim();
  return text.startsWith('{') || text.startsWith('[');
}

function normalizeAdvisorResponse(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[ \t]*[-*][ \t]*(Key Insights|What['’]s Good|What Needs Improvement|What You Should Do Next)[ \t]*:?/gim, '$1:')
    .replace(/^[ \t]*(Key Insights|What['’]s Good|What Needs Improvement|What You Should Do Next)[ \t]*:?/gim, (match, heading) => {
      if (/^what['’]s good$/i.test(heading)) {
        return "What's Good:";
      }

      if (/^key insights$/i.test(heading)) {
        return 'Key Insights:';
      }

      if (/^what needs improvement$/i.test(heading)) {
        return 'What Needs Improvement:';
      }

      return 'What You Should Do Next:';
    })
    .trim();
}

function buildAdvisorFallbackResponse({ queryType, intents, context, message }) {
  const domainLabel = intents.length > 0 ? intents.join(' and ') : 'general';
  const contextAvailable = Boolean(String(context || '').trim());
  const userMessage = String(message || '').trim();

  return [
    'Key Insights:',
    contextAvailable
      ? `- Your request is mainly about ${domainLabel}, and the available context was used to keep this grounded.`
      : `- This looks like a ${queryType} request, but there was limited structured context available.`,
    '',
    "What's Good:",
    contextAvailable
      ? '- There is enough signal in the current context to identify a practical next move.'
      : '- The question is clear enough to respond without inventing personal data.',
    '',
    'What Needs Improvement:',
    contextAvailable
      ? '- The next step should be turned into a short-term concrete habit or tracking action.'
      : '- More structured personal data would allow more precise recommendations.',
    '',
    'What You Should Do Next:',
    contextAvailable
      ? '- Pick one metric from this reply and review it again within the next 7 days.'
      : '- Ask a more specific follow-up question if you want a tighter recommendation.',
    contextAvailable
      ? '- Turn the biggest issue mentioned into a single action you can complete this week.'
      : '- If this is about your own data, ask about finance, gym, or both so Atlas can use the right context.',
    contextAvailable
      ? '- Track whether that action improves the situation before changing multiple things at once.'
      : '- Keep the next prompt focused on one goal so the advice can stay concrete.',
    userMessage ? `- Use "${truncateMessage(userMessage)}" as the specific topic for your next follow-up.` : '- Re-ask with one specific goal in mind.',
  ].join('\n');
}

function truncateMessage(message) {
  return message.length > 60 ? `${message.slice(0, 57)}...` : message;
}

module.exports = {
  REQUIRED_SECTIONS,
  validateAdvisorResponse,
  normalizeAdvisorResponse,
  looksLikeStructuredData,
  buildAdvisorFallbackResponse,
};
