const express = require('express');
const { generate, generateEvolving, evolving, current, stats } = require('../controllers/schedule.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('student'));
router.post('/generate', generate);
router.post('/evolving/generate', generateEvolving);
router.get('/evolving', evolving);
router.get('/current', current);
router.get('/current/stats', stats);
router.post('/regenerate', generate);

module.exports = router;
