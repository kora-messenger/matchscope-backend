const express = require('express');
const router = express.Router();
const dataProvider = require('../services/dataProvider');
const { validateMatchId, validateMatchesQuery } = require('../middleware/validateQuery');

// GET /api/fixtures?days=N — compact app-facing window feed (upcoming + live
// within N days, plus today's completed). Only available in live mode.
router.get('/window', async (req, res, next) => {
  try {
    const result = await dataProvider.getFixtureWindow(parseInt(req.query.days || '5', 10));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches
router.get('/', validateMatchesQuery, async (req, res, next) => {
  try {
    const { sport, status, limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const result = await dataProvider.getMatches({
      sport,
      status,
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id/stats
router.get('/:id/stats', validateMatchId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const statsResponse = await dataProvider.getMatchStats(id);

    if (!statsResponse) {
      return res.status(404).json({
        demo: true,
        sources: [],
        error: {
          code: 'match_not_found',
          message: `Match statistics for ID '${id}' were not found`
        }
      });
    }

    res.status(200).json(statsResponse);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id/table
router.get('/:id/table', validateMatchId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tableResponse = await dataProvider.getMatchTable(id);

    if (!tableResponse) {
      return res.status(404).json({
        demo: true,
        sources: [],
        error: {
          code: 'table_not_found',
          message: `League table or ranking for match ID '${id}' was not found`
        }
      });
    }

    res.status(200).json(tableResponse);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id/predictions
router.get('/:id/predictions', validateMatchId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const predictionsResponse = await dataProvider.getMatchPredictions(id);

    if (!predictionsResponse) {
      return res.status(404).json({
        demo: true,
        sources: [],
        error: {
          code: 'prediction_not_found',
          message: `Predictions for match ID '${id}' were not found`
        }
      });
    }

    res.status(200).json(predictionsResponse);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id
router.get('/:id', validateMatchId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const matchResponse = await dataProvider.getMatchById(id);

    if (!matchResponse) {
      return res.status(404).json({
        demo: true,
        sources: [],
        error: {
          code: 'match_not_found',
          message: `Match with ID '${id}' was not found`
        }
      });
    }

    res.status(200).json(matchResponse);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
