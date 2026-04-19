const express = require('express');
const {
  me,
  updateContactAction,
  linkStudentAction,
  myStudents,
  studentOverview,
  respondStudentNotificationAction
} = require('../controllers/parent.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('parent'));
router.get('/me', me);
router.put('/me/contact', updateContactAction);
router.post('/link-student', linkStudentAction);
router.get('/my-students', myStudents);
router.get('/students/:studentUid/overview', studentOverview);
router.post('/students/:studentUid/notifications/:notificationId/respond', respondStudentNotificationAction);

module.exports = router;
