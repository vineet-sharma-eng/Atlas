const config = require('../config');

function listModels(req, res) {
  res.status(200).json({
    object: 'list',
    data: [
      {
        id: config.openAiModelId,
        object: 'model',
        created: 0,
        owned_by: 'atlas',
      },
    ],
  });
}

module.exports = {
  listModels,
};
