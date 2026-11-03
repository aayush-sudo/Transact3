const express = require('express');
const router = express.Router();
const orchestrationController = require('../controllers/orchestrationController');
const { protect } = require('../middleware');

router.post('/route', orchestrationController.previewRoute);
router.post('/provider-quotes', orchestrationController.getProviderQuotes);
router.post('/fx-forecast', orchestrationController.getFXForecast);
router.get('/rails', orchestrationController.getRailsStatus);
router.post('/evaluate', orchestrationController.runEvaluation);
router.post('/ai-query', protect, orchestrationController.aiQuery);

module.exports = router;
