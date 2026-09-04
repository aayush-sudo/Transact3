const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.get('/metrics', protect, adminController.getAdminMetrics);
router.get('/transactions', protect, adminController.getAdminTransactions);
router.get('/reconcile-ledger', protect, adminController.reconcileLedger);
router.get('/verify-audit-chain', protect, adminController.verifyAuditChain);

module.exports = router;
