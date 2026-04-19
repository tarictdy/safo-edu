const express = require('express');
const {
  profile,
  updateProfileAction,
  updateContactSettingsAction,
  updatePreferencesAction,
  updateDifficultiesAction,
  saveFixedCoursesAction,
  saveExamsAction,
  saveAssignmentsAction,
  saveImportantDaysAction,
  parentRequestsAction,
  respondToParentRequestAction
} = require('../controllers/student.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('student'));
router.get('/profile', profile);
router.get('/me', profile);
router.put('/me', updateProfileAction);
router.put('/me/contact', updateContactSettingsAction);
router.put('/me/preferences', updatePreferencesAction);
router.put('/me/difficulties', updateDifficultiesAction);
router.put('/me/important-days', saveImportantDaysAction);
router.post('/me/fixed-courses', saveFixedCoursesAction);
router.get('/me/fixed-courses', profile);
router.post('/me/exams', saveExamsAction);
router.get('/me/exams', profile);
router.put('/me/assignments', saveAssignmentsAction);
router.get('/me/assignments', profile);
router.get('/me/parent-requests', parentRequestsAction);
router.post('/me/parent-requests/:linkId/respond', respondToParentRequestAction);

module.exports = router;
