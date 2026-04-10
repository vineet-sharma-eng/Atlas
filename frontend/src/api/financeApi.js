import { request } from './atlasApi';

export function getFinanceAnalysis(days = 7) {
  const params = new URLSearchParams({ days: String(days) });

  return request(`/finance/analysis?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
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
