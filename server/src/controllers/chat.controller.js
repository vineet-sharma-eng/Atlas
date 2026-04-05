const crypto = require('crypto');

const config = require('../config');
const routerService = require('../services/router.service');
const { AppError } = require('../utils/errorHandler');

async function createChatCompletion(req, res, next) {
  try {
    const { model, messages } = req.body || {};

    if (model !== config.openAiModelId) {
      throw new AppError(`Unsupported model: ${model}`, 400, {
        supportedModels: [config.openAiModelId],
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AppError('messages must be a non-empty array', 400);
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message && message.role === 'user' && typeof message.content === 'string');

    if (!latestUserMessage || !latestUserMessage.content.trim()) {
      throw new AppError('A non-empty user message is required', 400);
    }

    const orchestration = await routerService.orchestrateChat({
      message: latestUserMessage.content.trim(),
      requestId: req.requestId,
    });

    return res.status(200).json({
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: config.openAiModelId,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: orchestration.content,
          },
        },
      ],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createChatCompletion,
};
