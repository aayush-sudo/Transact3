const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, getRecipients } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.get('/recipients', protect, getRecipients);

module.exports = router;
