const express = require('express');

const {
  addExercise,
  addTemplateExercise,
  addSet,
  createTemplateExerciseAlternateHandler,
  deleteSessionExerciseHandler,
  deleteSessionHandler,
  duplicateTemplateHandler,
  endSession,
  getExerciseHistoryHandler,
  getExerciseProgressHandler,
  getActiveSession,
  getExerciseCatalogHandler,
  getTemplateExerciseAlternatesHandler,
  listRecentExercisesHandler,
  getSessionDetail,
  initSession,
  renameExerciseHandler,
  listSessions,
  listTemplates,
  renameTemplate,
  removeExercise,
  reorderTemplate,
  startSession,
  toggleTemplateExerciseVisibility,
  updateTemplateSetHandler,
  updateSessionExerciseOverrideHandler,
  updateExerciseStatus,
} = require('../modules/gym/gym.controller');

const router = express.Router();

router.get('/templates', listTemplates);
router.get('/exercises', getExerciseCatalogHandler);
router.get('/exercises/recent', listRecentExercisesHandler);
router.get('/sessions', listSessions);
router.get('/session/active', getActiveSession);
router.get('/session/init/:template_id', initSession);
router.get('/session/:id', getSessionDetail);
router.get('/exercises/:id/history', getExerciseHistoryHandler);
router.get('/exercises/:id/progress', getExerciseProgressHandler);
router.get('/template/exercise/:id/alternates', getTemplateExerciseAlternatesHandler);
router.post('/session/start', startSession);
router.post('/session/end', endSession);
router.post('/exercise', addExercise);
router.delete('/exercise/:id', removeExercise);
router.delete('/session/:id', deleteSessionHandler);
router.delete('/session-exercise/:id', deleteSessionExerciseHandler);
router.patch('/exercise/:id/status', updateExerciseStatus);
router.patch('/exercises/:id', renameExerciseHandler);
router.patch('/session-exercise/:id', updateSessionExerciseOverrideHandler);
router.post('/set', addSet);
router.patch('/template/:id', renameTemplate);
router.patch('/template/:id/reorder', reorderTemplate);
router.patch('/template/exercise/:id/toggle', toggleTemplateExerciseVisibility);
router.patch('/template/set/:id', updateTemplateSetHandler);
router.post('/template/exercise/add', addTemplateExercise);
router.post('/template/exercise/:id/alternates', createTemplateExerciseAlternateHandler);
router.post('/template/:id/duplicate', duplicateTemplateHandler);

module.exports = router;
