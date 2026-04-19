const express = require('express');
const {
  register,
  registerStudentAction,
  registerParentAction,
  login,
  logout,
  me
} = require('../controllers/auth.controller');
const {
  validateRegisterPayload,
  validateLoginPayload,
  validateRegisterParentPayload
} = require('../middlewares/validation.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', validateRegisterPayload, register);
router.post('/register/student', validateRegisterPayload, registerStudentAction);
router.post('/register/parent', validateRegisterParentPayload, registerParentAction);
router.post('/login', validateLoginPayload, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
