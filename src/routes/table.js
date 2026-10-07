const express = require('express');
const router = express.Router();
const dataProvider = require('../services/dataProvider');
const { validateMatchId } = require('../middleware/validateQuery');

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

module.exports = router;
