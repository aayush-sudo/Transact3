const express = require('express');
const router = express.Router();
const { getPortfolio } = require('../controllers/portfolioController');
const walletFundingController = require('../controllers/walletFundingController');
const { protect } = require('../middleware');

router.route('/')
  .get(protect, getPortfolio);
router.post('/funding/order', protect, walletFundingController.createFundingOrder);
router.post('/funding/verify', protect, walletFundingController.verifyFundingPayment);
router.get('/funding/:orderId', protect, walletFundingController.getFundingStatus);

module.exports = router;
