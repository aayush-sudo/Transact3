const express = require('express');
const router = express.Router();
const orchestrationController = require('../controllers/orchestrationController');
const { protect, optionalProtect } = require('../middleware');

router.post('/route', optionalProtect, orchestrationController.previewRoute);
router.post('/provider-quotes', orchestrationController.getProviderQuotes);
router.post('/fx-forecast', orchestrationController.getFXForecast);
router.get('/rails', orchestrationController.getRailsStatus);
router.post('/evaluate', orchestrationController.runEvaluation);
router.post('/ai-query', protect, orchestrationController.aiQuery);

// Multi-Agent System Endpoints
router.post('/agent/fx-mandate', protect, orchestrationController.createFXMandate);
router.get('/agent/fx-mandates', protect, orchestrationController.getFXMandates);
router.post('/agent/fx-mandates/evaluate', protect, orchestrationController.evaluateFXMandates);
router.delete('/agent/fx-mandates/:id', protect, orchestrationController.cancelFXMandate);
router.get('/agent/liquidity-health', protect, orchestrationController.getLiquidityHealth);
router.post('/agent/liquidity-reroute', protect, orchestrationController.planLiquidityReroute);
router.post('/agent/compliance-screen', protect, orchestrationController.screenCompliance);
router.post('/agent/compliance-resolve', protect, orchestrationController.resolveComplianceChallenge);

module.exports = router;
