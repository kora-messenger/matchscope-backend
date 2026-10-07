const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', (req, res) => {
  const isDemo = config.isDemoMode();

  res.status(200).json({
    status: 'ok',
    demo: isDemo,
    sources: [],
    data_mode: config.dataMode,
    capabilities: {
      demo_mode_active: isDemo,
      sports_provider_configured: config.provider.apiKeyConfigured,
      prediction_engine_configured: config.predictionEngine.apiKeyConfigured,
      live_sports_feed_active: config.capabilities.live_sports_data,
      ai_prediction_engine_active: config.capabilities.ai_predictions
    },
    service: 'matchscope-ai-backend',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
