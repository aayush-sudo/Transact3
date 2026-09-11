const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');
const { checkIdempotency } = require('../middleware/idempotency');

router.post('/quote', protect, transactionController.createTransactionQuote);
router.post('/confirm', protect, checkIdempotency, transactionController.confirmAndExecuteTransaction);
router.post('/send', protect, checkIdempotency, transactionController.confirmAndExecuteTransaction);
router.get('/history', protect, transactionController.getTransactionHistory);
router.post('/compliance/screen', transactionController.screenCompliance);
router.post('/routing/graph-path', transactionController.getGraphPath);
router.get('/:id/iso20022', protect, transactionController.getTransactionIsoXml);
router.get('/:id', protect, transactionController.getTransactionById);

module.exports = router;
