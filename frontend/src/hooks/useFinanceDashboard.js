import { useEffect, useState } from 'react';
import {
  getFinanceAnalysis,
  getFinanceTransactions,
  importFinancePdf,
  updateFinanceTransactionCategory,
} from '../api/financeApi';

const EMPTY_ANALYSIS = {
  summary: '',
  data: {
    totalSpent: 0,
    topCategory: null,
    categoryBreakdown: [],
    largestTransaction: null,
  },
  meta: {
    periodDays: 30,
    transactionCount: 0,
    trend: null,
  },
};

export function useFinanceDashboard() {
  const [analysisDays, setAnalysisDays] = useState(30);
  const [analysis, setAnalysis] = useState(EMPTY_ANALYSIS);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [analysisError, setAnalysisError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState('');
  const [pendingCategoryTransactionId, setPendingCategoryTransactionId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    void refreshAnalysis(analysisDays);
  }, [analysisDays]);

  useEffect(() => {
    void refreshTransactions();
  }, []);

  async function refreshAnalysis(days = analysisDays) {
    setIsLoadingAnalysis(true);
    setAnalysisError('');

    try {
      const payload = await getFinanceAnalysis(days);
      setAnalysis(payload || EMPTY_ANALYSIS);
    } catch (error) {
      setAnalysis(EMPTY_ANALYSIS);
      setAnalysisError(error.message || 'Failed to load finance analysis');
    } finally {
      setIsLoadingAnalysis(false);
    }
  }

  async function refreshTransactions() {
    setIsLoadingTransactions(true);
    setTransactionsError('');

    try {
      const payload = await getFinanceTransactions({ limit: 50 });
      setTransactions(payload.transactions || []);
    } catch (error) {
      setTransactions([]);
      setTransactionsError(error.message || 'Failed to load transactions');
    } finally {
      setIsLoadingTransactions(false);
    }
  }

  async function uploadStatement(file) {
    setIsUploading(true);
    setUploadError('');

    try {
      const result = await importFinancePdf(file);
      setUploadResult(result);
      await Promise.all([
        refreshAnalysis(analysisDays),
        refreshTransactions(),
      ]);
      return result;
    } catch (error) {
      setUploadError(error.message || 'Failed to import statement');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }

  async function saveTransactionCategory(transactionId, category) {
    setPendingCategoryTransactionId(String(transactionId));
    setTransactionsError('');

    try {
      const payload = await updateFinanceTransactionCategory(transactionId, category);
      const updatedTransaction = payload?.transaction;

      setTransactions((current) =>
        current.map((transaction) =>
          String(transaction.id) === String(transactionId)
            ? { ...transaction, ...updatedTransaction }
            : transaction
        )
      );

      await refreshAnalysis(analysisDays);
      return updatedTransaction;
    } catch (error) {
      setTransactionsError(error.message || 'Failed to update transaction category');
      throw error;
    } finally {
      setPendingCategoryTransactionId('');
    }
  }

  return {
    analysisDays,
    setAnalysisDays,
    analysis,
    isLoadingAnalysis,
    analysisError,
    transactions,
    isLoadingTransactions,
    transactionsError,
    pendingCategoryTransactionId,
    isUploading,
    uploadError,
    uploadResult,
    refreshAnalysis,
    refreshTransactions,
    saveTransactionCategory,
    uploadStatement,
  };
}
