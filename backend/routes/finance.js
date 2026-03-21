const express = require('express');

const { getAnalysis, importPdf } = require('../modules/finance/finance.controller');

const router = express.Router();

router.post('/import-pdf', importPdf);
router.get('/analysis', getAnalysis);

module.exports = router;
