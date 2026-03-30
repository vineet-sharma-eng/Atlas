const express = require('express');

const {
  addExercise,
  addTemplateExercise,
  addSet,
  initSession,
  listTemplates,
  removeExercise,
  skipExercise,
  startSession,
} = require('../modules/gym/gym.controller');

const router = express.Router();

router.get('/templates', listTemplates);
router.get('/session/init/:template_id', initSession);
router.post('/session/start', startSession);
router.post('/exercise', addExercise);
router.delete('/exercise/:id', removeExercise);
router.post('/exercise/:id/skip', skipExercise);
router.post('/set', addSet);
router.post('/template/exercise/add', addTemplateExercise);

module.exports = router;
