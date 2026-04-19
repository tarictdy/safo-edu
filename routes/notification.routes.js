const express = require('express');
const { inbox, respond, missed } = require('../controllers/notification.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('student'));
router.get('/inbox', inbox);
router.post('/:notificationId/respond', respond);
router.get('/missed', missed);

module.exports = router;
