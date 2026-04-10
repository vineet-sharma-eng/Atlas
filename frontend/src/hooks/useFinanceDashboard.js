import { useEffect, useState } from 'react';
import { getFinanceAnalysis, importFinancePdf } from '../api/financeApi';

const EMPTY_ANALYSIS = {
  summary: '',
  data: {
    totalSpent: 0,
    topCategory: null,
    categoryBreakdown: [],
    largestTransaction: null,
  },
  meta: {
    periodDays: 7,
    transactionCount: 0,
    trend: null,
  },
};

export function useFinanceDashboard() {
  const [analysis, setAnalysis] = useState(EMPTY_ANALYSIS);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [analysisError, setAnalysisError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    void refreshAnalysis();
  }, []);

  async function refreshAnalysis() {
    setIsLoadingAnalysis(true);
    setAnalysisError('');

    try {
      const payload = await getFinanceAnalysis();
      setAnalysis(payload || EMPTY_ANALYSIS);
    } catch (error) {
      setAnalysis(EMPTY_ANALYSIS);
      setAnalysisError(error.message || 'Failed to load finance analysis');
    } finally {
      setIsLoadingAnalysis(false);
    }
  }

  async function uploadStatement(file) {
    setIsUploading(true);
    setUploadError('');

    try {
      const result = await importFinancePdf(file);
      setUploadResult(result);
      await refreshAnalysis();
      return result;
    } catch (error) {
      setUploadError(error.message || 'Failed to import statement');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }

  return {
    analysis,
    isLoadingAnalysis,
    analysisError,
    isUploading,
    uploadError,
    uploadResult,
    refreshAnalysis,
    uploadStatement,
  };
}
