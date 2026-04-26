const express = require('express');
const router = express.Router();
const { getPortfolio, addHolding } = require('../controllers/portfolioController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getPortfolio)
  .post(protect, addHolding);

module.exports = router;
