const express = require('express');

const {
  getAnalysis,
  getTransactions,
  importPdf,
  patchTransactionCategory,
  listInsights,
  triggerInsights,
} = require('../modules/finance/finance.controller');

const router = express.Router();

router.post('/import-pdf', importPdf);
router.get('/analysis', getAnalysis);
router.get('/transactions', getTransactions);
router.patch('/transactions/:id', patchTransactionCategory);
router.get('/generate-insights', triggerInsights);
router.get('/insights', listInsights);

module.exports = router;
