const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  getRecipients,
  updateAccountCountry,
  completeDemoVerification
} = require('../controllers/authController');
const { protect } = require('../middleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/account-country', protect, updateAccountCountry);
router.post('/demo-verification', protect, completeDemoVerification);
router.get('/recipients', protect, getRecipients);

module.exports = router;
