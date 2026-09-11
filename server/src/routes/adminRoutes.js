const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.get('/metrics', protect, adminController.getAdminMetrics);
router.get('/rails', protect, adminController.getAdminRails);
router.put('/rails/:railId', protect, adminController.updateRail);
router.get('/transactions', protect, adminController.getAdminTransactions);
router.get('/reconcile-ledger', protect, adminController.reconcileLedger);
router.get('/verify-audit-chain', protect, adminController.verifyAuditChain);
router.post('/simulation-controls', protect, adminController.updateSimulationControls);

module.exports = router;
