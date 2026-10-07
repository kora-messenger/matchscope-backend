const express = require('express');
const router = express.Router();
const { resolveBookingCode, BookingCodeError } = require('../services/bookingCodeResolver');
const config = require('../config');

// POST /api/slip/resolve
// Body: { bookmaker: string, code: string }
// Loads a real bookmaker booking code into its selections, proxied through
// this backend so the app never talks to the bookmaker directly.
router.post('/resolve', async (req, res, next) => {
  try {
    const { bookmaker, code } = req.body || {};

    if (typeof bookmaker !== 'string' || !bookmaker.trim()) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: { code: 'invalid_request', message: 'A bookmaker must be selected.' },
      });
    }
    if (typeof code !== 'string' || code.trim().length < 3 || code.trim().length > 40) {
      return res.status(400).json({
        demo: config.isDemoMode(),
        sources: [],
        error: { code: 'invalid_request', message: 'A booking code of 3-40 characters is required.' },
      });
    }

    const data = await resolveBookingCode({ bookmaker, code });
    return res.status(200).json({ status: 'success', data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
