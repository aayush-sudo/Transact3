const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');
const { validatePaymentQuoteRequest, validatePaymentExecuteRequest } = require('../middleware/validation');
const { checkIdempotency } = require('../middleware/idempotency');

router.post('/quote', protect, validatePaymentQuoteRequest, transactionController.createTransactionQuote);
router.post('/send', protect, checkIdempotency, validatePaymentExecuteRequest, transactionController.executeTransaction);
router.get('/history', protect, transactionController.getTransactionHistory);

module.exports = router;
