const express = require('express');
const router = express.Router();
const { sendTransaction, getTransactionHistory } = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send', protect, sendTransaction);
router.get('/history', protect, getTransactionHistory);

module.exports = router;
