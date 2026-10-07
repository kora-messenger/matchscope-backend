const express = require('express');
const router = express.Router();
const dataProvider = require('../services/dataProvider');

router.get('/', async (req, res, next) => {
  try {
    const response = await dataProvider.getSports();
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
