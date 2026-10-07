const express = require('express');
const router = express.Router();
const dataProvider = require('../services/dataProvider');
const { validateMatchId } = require('../middleware/validateQuery');

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

module.exports = router;
