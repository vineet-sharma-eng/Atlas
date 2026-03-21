const MONTH_MAP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const CURRENCY_PATTERN = '(?:\\u20B9|Rs\\.?|INR)';
const AMOUNT_PATTERN = `[+-]?\\s*${CURRENCY_PATTERN}?\\s*[\\d,]+(?:\\.\\d{1,2})?`;

const INLINE_TRANSACTION_PATTERNS = [
  new RegExp(
    `(?<date>\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})\\s+(?<description>.+?)\\s+(?<amount>${AMOUNT_PATTERN})`,
    'i'
  ),
  new RegExp(
    `(?<date>\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{2,4})\\s+(?<description>.+?)\\s+(?<amount>${AMOUNT_PATTERN})`,
    'i'
  ),
];

const NOISE_PATTERNS = [
  /^google pay/i,
  /^transaction/i,
  /^upi transaction id/i,
  /^utr/i,
  /^account/i,
  /^bank account/i,
  /^paidby/i,
  /^receivedin/i,
  /^from bank/i,
  /^date&time/i,
  /^page \d+/i,
  /^summary/i,
  /^total/i,
  /^opening balance/i,
  /^closing balance/i,
  /^notes?$/i,
  /^status$/i,
  /^paid$/i,
  /^received$/i,
];

function normalizeLine(line) {
  return line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanupText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean);
}

function parseDateToken(value) {
  const input = value.trim().replace(/,/g, '');
  let match = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);

  if (match) {
    let [, day, month, year] = match;
    let fullYear = Number(year);

    if (fullYear < 100) {
      fullYear += fullYear >= 70 ? 1900 : 2000;
    }

    return toIsoDate(fullYear, Number(month), Number(day));
  }

  match = input.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);

  if (!match) {
    match = input.match(/^(\d{1,2})([A-Za-z]{3,9})(\d{2,4})$/);
  }

  if (!match) {
    return null;
  }

  const [, day, monthName, year] = match;
  const month = MONTH_MAP[monthName.toLowerCase()];

  if (!month) {
    return null;
  }

  let fullYear = Number(year);
  if (fullYear < 100) {
    fullYear += fullYear >= 70 ? 1900 : 2000;
  }

  return toIsoDate(fullYear, month, Number(day));
}

function toIsoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function extractDate(line) {
  const match = line.match(
    /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|\d{1,2}[A-Za-z]{3,9},?\d{2,4})/
  );

  if (!match) {
    return null;
  }

  return parseDateToken(match[1]);
}

function parseAmount(value) {
  const cleaned = value
    .replace(/,/g, '')
    .replace(/(?:INR|Rs\.?|\u20B9)/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? Math.abs(amount) : null;
}

function extractAmounts(text) {
  const amountRegex = new RegExp(AMOUNT_PATTERN, 'gi');
  const matches = text.match(amountRegex) || [];

  return matches
    .map((value) => ({
      raw: value,
      amount: parseAmount(value),
    }))
    .filter((entry) => entry.amount !== null);
}

function inferType(text, rawAmount) {
  const normalized = text.toLowerCase();

  if (/received from|receivedfrom|credited by|creditedby|cashback|refund|reward|deposit|added to bank|received/.test(normalized)) {
    return 'credit';
  }

  if (/paid to|paidto|sent to|sentto|debited|payment to|paymentto|spent at|spentat|bill payment/.test(normalized)) {
    return 'debit';
  }

  if (rawAmount && rawAmount.trim().startsWith('-')) {
    return 'debit';
  }

  if (rawAmount && rawAmount.trim().startsWith('+')) {
    return 'credit';
  }

  return 'debit';
}

function categorize(description) {
  const value = description.toLowerCase();

  if (/(swiggy|zomato|restaurant|cafe|coffee|food|dining|pizza|kitchen)/.test(value)) {
    return 'food';
  }

  if (/(uber|ola|metro|rapido|fuel|petrol|diesel|transport|bus|train|irctc)/.test(value)) {
    return 'transport';
  }

  if (/(amazon|flipkart|myntra|meesho|store|mart|supermarket|grocery|blinkit|instamart|zepto)/.test(value)) {
    return 'shopping';
  }

  if (/(electricity|water bill|gas bill|broadband|recharge|mobile|internet|utility)/.test(value)) {
    return 'utilities';
  }

  if (/(salary|interest|refund|cashback|reward)/.test(value)) {
    return 'income';
  }

  return 'uncategorized';
}

function buildDescription(lines, dateText, amountText) {
  const ignoredTokens = new Set([dateText, amountText].filter(Boolean));

  const filtered = lines.filter((line) => {
    if (!line) {
      return false;
    }

    if (ignoredTokens.has(line)) {
      return false;
    }

    if (extractDate(line)) {
      return false;
    }

    if (new RegExp(`^${CURRENCY_PATTERN}\\s*[\\d,]+(?:\\.\\d{1,2})?$`, 'i').test(line)) {
      return false;
    }

    return !NOISE_PATTERNS.some((pattern) => pattern.test(line));
  });

  return filtered
    .slice(0, 3)
    .map(normalizeDescriptionLine)
    .filter(Boolean)
    .join(' | ')
    .trim();
}

function normalizeDescriptionLine(line) {
  let value = line.trim();

  value = value
    .replace(/^paidto/i, 'Paid to ')
    .replace(/^receivedfrom/i, 'Received from ')
    .replace(/^sentto/i, 'Sent to ')
    .replace(/^paid by/i, 'Paid by ')
    .replace(/^paidby/i, 'Paid by ')
    .replace(/^receivedin/i, 'Received in ');

  return value;
}

function parseInlineTransactions(lines) {
  const transactions = [];

  for (const line of lines) {
    for (const pattern of INLINE_TRANSACTION_PATTERNS) {
      const match = line.match(pattern);
      if (!match || !match.groups) {
        continue;
      }

      const date = parseDateToken(match.groups.date);
      const amount = parseAmount(match.groups.amount);

      if (!date || amount === null) {
        continue;
      }

      const description = normalizeLine(match.groups.description);

      transactions.push({
        date,
        amount,
        description,
        category: categorize(description),
        type: inferType(line, match.groups.amount),
      });

      break;
    }
  }

  return transactions;
}

function splitIntoBlocks(lines) {
  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    if (extractDate(line) && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [line];
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function parseBlock(block) {
  const blockText = block.join(' ');
  const dateLine = block.find((line) => extractDate(line));
  const date = dateLine ? extractDate(dateLine) : null;
  const amounts = extractAmounts(blockText);
  const amountEntry = amounts[amounts.length - 1];

  if (!date || !amountEntry) {
    return null;
  }

  const description = buildDescription(block, dateLine, amountEntry.raw);

  if (!description) {
    return null;
  }

  return {
    date,
    amount: amountEntry.amount,
    description,
    category: categorize(description),
    type: inferType(blockText, amountEntry.raw),
  };
}

function deduplicateTransactions(transactions) {
  const seen = new Set();
  const unique = [];

  for (const transaction of transactions) {
    const key = [
      transaction.date,
      transaction.amount.toFixed(2),
      transaction.description.toLowerCase(),
      transaction.type,
    ].join('|');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(transaction);
  }

  return unique;
}

function parseGooglePayTransactions(rawText) {
  const lines = cleanupText(rawText);

  if (lines.length === 0) {
    return [];
  }

  const inlineTransactions = parseInlineTransactions(lines);
  if (inlineTransactions.length > 0) {
    return deduplicateTransactions(inlineTransactions);
  }

  const blocks = splitIntoBlocks(lines);
  const parsed = blocks.map(parseBlock).filter(Boolean);

  return deduplicateTransactions(parsed);
}

module.exports = {
  parseGooglePayTransactions,
};
