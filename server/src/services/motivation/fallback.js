const FALLBACK_QUOTES = [
  'Show up before motivation does.',
  'Small reps beat big plans.',
  'Track it, then improve it.',
  'Consistency builds quiet confidence.',
  'Finish today stronger than yesterday.',
  'Spend with intention, not impulse.',
  'Make progress visible every week.',
];

function getFallbackQuotes() {
  return FALLBACK_QUOTES.slice();
}

module.exports = {
  getFallbackQuotes,
};
