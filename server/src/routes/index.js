const express = require('express');

const chatController = require('../controllers/chat.controller');
const modelController = require('../controllers/model.controller');
const financeRoutes = require('../../routes/finance');
const gymRoutes = require('../../routes/gym');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'Atlas running' });
});

router.get('/v1/models', modelController.listModels);
router.post('/v1/chat/completions', chatController.createChatCompletion);

router.use('/finance', financeRoutes);
router.use('/gym', gymRoutes);

module.exports = router;
