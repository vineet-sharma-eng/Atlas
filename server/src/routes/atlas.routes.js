const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const moduleController = require('../controllers/module.controller');
const insightController = require('../controllers/insight.controller');

const router = express.Router();

router.get('/dashboard', dashboardController.getDashboard);
router.get('/modules', moduleController.listModules);
router.get('/insights/:id', insightController.getInsight);

module.exports = router;
