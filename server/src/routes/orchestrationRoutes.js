const express = require('express');
const router = express.Router();
const orchestrationController = require('../controllers/orchestrationController');

router.post('/route', orchestrationController.previewRoute);
router.post('/fx-forecast', orchestrationController.getFXForecast);
router.get('/rails', orchestrationController.getRailsStatus);
router.post('/evaluate', orchestrationController.runEvaluation);

module.exports = router;
