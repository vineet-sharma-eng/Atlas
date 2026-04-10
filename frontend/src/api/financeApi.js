import { request } from './atlasApi';

export function getFinanceAnalysis(days = 30) {
  const params = new URLSearchParams();

  if (days === 'all' || days === null) {
    params.set('days', 'all');
  } else {
    params.set('days', String(days));
  }

  return request(`/finance/analysis?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function getFinanceTransactions({ days, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });

  if (Number.isInteger(days) && days > 0) {
    params.set('days', String(days));
  }

  return request(`/finance/transactions?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function updateFinanceTransactionCategory(transactionId, category) {
  return request(`/finance/transactions/${transactionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category }),
  });
}

export function importFinancePdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  return request('/finance/import-pdf', {
    method: 'POST',
    body: formData,
  });
}
