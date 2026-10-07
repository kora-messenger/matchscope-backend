const config = require('../config');
const { DataProviderError } = require('../services/dataProvider');
const { BookingCodeError } = require('../services/bookingCodeResolver');

function errorHandler(err, req, res, next) {
  // DataProviderError handling (e.g. 503 data_provider_not_configured)
  if (err instanceof DataProviderError) {
    return res.status(err.statusCode).json({
      demo: config.isDemoMode(),
      sources: [],
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode
      }
    });
  }

  // BookingCodeError handling (real booking-code lookups: 400/404/502)
  if (err instanceof BookingCodeError) {
    return res.status(err.statusCode).json({
      demo: config.isDemoMode(),
      sources: [],
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode
      }
    });
  }

  // Generic internal server error sanitation
  console.error('[MatchScope Backend Error]:', err.message);

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    demo: config.isDemoMode(),
    sources: [],
    error: {
      code: 'internal_server_error',
      message: 'An unexpected internal server error occurred',
      status: statusCode
    }
  });
}

module.exports = errorHandler;
