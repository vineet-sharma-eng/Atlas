const express = require('express');

const chatController = require('../controllers/chat.controller');
const modelController = require('../controllers/model.controller');
const motivationService = require('../services/motivation/motivation.service');
const atlasRoutes = require('./atlas.routes');
const financeRoutes = require('../../routes/finance');
const gymRoutes = require('../../routes/gym');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'Atlas running' });
});

router.get('/v1/models', modelController.listModels);
router.post('/v1/chat/completions', chatController.createChatCompletion);
router.get('/motivation', async (req, res, next) => {
  try {
    return res.status(200).json(await motivationService.getMotivationQuote());
  } catch (error) {
    return next(error);
  }
});

router.use('/atlas', atlasRoutes);
router.use('/finance', financeRoutes);
router.use('/gym', gymRoutes);

module.exports = router;
