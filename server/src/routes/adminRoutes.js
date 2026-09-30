const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware');

router.get('/metrics', protect, authorize('ADMIN'), adminController.getAdminMetrics);
router.get('/rails', protect, authorize('ADMIN'), adminController.getAdminRails);
router.put('/rails/:railId', protect, authorize('ADMIN'), adminController.updateRail);
router.get('/transactions', protect, authorize('ADMIN'), adminController.getAdminTransactions);
router.get('/reconcile-ledger', protect, authorize('ADMIN'), adminController.reconcileLedger);
router.get('/verify-audit-chain', protect, authorize('ADMIN'), adminController.verifyAuditChain);
router.post('/simulation-controls', protect, authorize('ADMIN'), adminController.updateSimulationControls);

module.exports = router;
