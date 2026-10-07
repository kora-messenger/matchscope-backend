const config = require('../config');
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const ALLOWED_SPORTS = ['football', 'basketball', 'tennis'];
const ALLOWED_STATUSES = ['upcoming', 'completed', 'live'];

function validateMatchId(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || !SAFE_ID_REGEX.test(id)) {
    return res.status(400).json({
      demo: config.isDemoMode(),
      sources: [],
      error: {
        code: 'invalid_id_format',
        message: 'Invalid match ID parameter format. Must be alphanumeric with underscores or hyphens up to 64 characters.'
      }
    });
  }
  next();
}

function validateMatchesQuery(req, res, next) {
  const { sport, status, limit, offset } = req.query;

  if (sport !== undefined) {
    if (typeof sport !== 'string' || !ALLOWED_SPORTS.includes(sport.toLowerCase())) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: {
          code: 'invalid_query_parameter',
          message: `Invalid sport parameter. Allowed sports: ${ALLOWED_SPORTS.join(', ')}`
        }
      });
    }
  }

  if (status !== undefined) {
    if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: {
          code: 'invalid_query_parameter',
          message: `Invalid status parameter. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`
        }
      });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (typeof limit !== 'string' || !/^\d+$/.test(limit) || !Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: {
          code: 'invalid_query_parameter',
          message: 'Limit parameter must be an integer between 1 and 50'
        }
      });
    }
  }

  if (offset !== undefined) {
    const parsedOffset = parseInt(offset, 10);
    if (typeof offset !== 'string' || !/^\d+$/.test(offset) || !Number.isSafeInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: {
          code: 'invalid_query_parameter',
          message: 'Offset parameter must be a non-negative integer'
        }
      });
    }
  }

  next();
}

module.exports = {
  validateMatchId,
  validateMatchesQuery
};
