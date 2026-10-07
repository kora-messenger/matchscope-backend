const express = require('express');
const router = express.Router();
const dataProvider = require('../services/dataProvider');
const { validateMatchId } = require('../middleware/validateQuery');

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

module.exports = router;
