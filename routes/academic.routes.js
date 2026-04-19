const express = require('express');
const {
  getClasses,
  getProgram,
  getPrograms,
  putProgram,
  postSubject,
  putSubject,
  deleteSubject,
  syncOfficialPrograms
} = require('../controllers/academic.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);
router.get('/classes', getClasses);
router.get('/programs', getPrograms);
router.post('/programs/sync-official-coefficients', syncOfficialPrograms);
router.get('/classes/:classCode/program', getProgram);
router.put('/classes/:classCode/program', putProgram);
router.post('/classes/:classCode/subjects', postSubject);
router.put('/classes/:classCode/subjects/:subjectCode', putSubject);
router.delete('/classes/:classCode/subjects/:subjectCode', deleteSubject);

module.exports = router;
