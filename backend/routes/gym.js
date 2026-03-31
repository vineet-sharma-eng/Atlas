const express = require('express');

const {
  addExercise,
  addTemplateExercise,
  addSet,
  duplicateTemplateHandler,
  endSession,
  getExerciseHistoryHandler,
  getExerciseProgressHandler,
  getActiveSession,
  listRecentExercisesHandler,
  getSessionDetail,
  initSession,
  listSessions,
  listTemplates,
  renameTemplate,
  removeExercise,
  reorderTemplate,
  startSession,
  toggleTemplateExerciseVisibility,
  updateTemplateSetHandler,
  updateExerciseStatus,
} = require('../modules/gym/gym.controller');

const router = express.Router();

router.get('/templates', listTemplates);
router.get('/exercises/recent', listRecentExercisesHandler);
router.get('/sessions', listSessions);
router.get('/session/active', getActiveSession);
router.get('/session/init/:template_id', initSession);
router.get('/session/:id', getSessionDetail);
router.get('/exercise/:name/history', getExerciseHistoryHandler);
router.get('/exercise/:name/progress', getExerciseProgressHandler);
router.post('/session/start', startSession);
router.post('/session/end', endSession);
router.post('/exercise', addExercise);
router.delete('/exercise/:id', removeExercise);
router.patch('/exercise/:id/status', updateExerciseStatus);
router.post('/set', addSet);
router.patch('/template/:id', renameTemplate);
router.patch('/template/:id/reorder', reorderTemplate);
router.patch('/template/exercise/:id/toggle', toggleTemplateExerciseVisibility);
router.patch('/template/set/:id', updateTemplateSetHandler);
router.post('/template/exercise/add', addTemplateExercise);
router.post('/template/:id/duplicate', duplicateTemplateHandler);

module.exports = router;
