const GENERAL_QUOTES = [
  'Show up before motivation does.',
  'Small reps beat big plans.',
  'Track it, then improve it.',
  'Consistency builds quiet confidence.',
  'Finish today stronger than yesterday.',
  'Make progress visible every week.',
];

const FINANCE_QUOTES = [
  'Spend with intention, not impulse.',
  'Small savings become strong habits.',
  'Review the pattern, not just the purchase.',
  'Clarity beats guilt in money decisions.',
  'Budgeting works best when it stays visible.',
];

const GYM_QUOTES = [
  'Progress favors the session you almost skipped.',
  'Good form compounds faster than ego.',
  'One steady week beats one heroic workout.',
  'Repeat the basics until they feel powerful.',
  'Strength grows through patient consistency.',
];

function getFallbackQuotes(domain = 'general') {
  const normalized = String(domain || 'general').trim().toLowerCase();

  if (normalized === 'finance') {
    return FINANCE_QUOTES.slice();
  }

  if (normalized === 'gym') {
    return GYM_QUOTES.slice();
  }

  return GENERAL_QUOTES.slice();
}

module.exports = {
  getFallbackQuotes,
};
