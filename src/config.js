require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  get dataMode() {
    return (process.env.DATA_MODE || 'prod').toLowerCase();
  },
  isLiveMode() {
    return this.dataMode === 'live';
  },
  get provider() {
    return {
      baseUrl: process.env.SPORTS_PROVIDER_BASE_URL || '',
      apiKeyConfigured: Boolean(process.env.SPORTS_PROVIDER_API_KEY),
      timeoutMs: parseInt(process.env.PROVIDER_TIMEOUT_MS || '5000', 10),
    };
  },
  get predictionEngine() {
    return {
      apiKeyConfigured: Boolean(process.env.PREDICTION_ENGINE_API_KEY),
    };
  },
  limits: {
    maxQueryLimit: 50,
    defaultQueryLimit: 20,
  },
  get capabilities() {
    return {
      demo_mode: this.isDemoMode(),
      live_sports_data: this.isLiveMode(),
      ai_predictions: this.isLiveMode(),
      prediction_engine: this.isLiveMode() ? 'matchscope-statmodel-v1' : null,
    };
  },
  isDemoMode() {
    return this.dataMode === 'demo';
  }
};

module.exports = config;
