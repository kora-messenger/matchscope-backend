const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const sportsRouter = require('./routes/sports');
const slipRouter = require('./routes/slip');
const matchesRouter = require('./routes/matches');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

// Routes
app.use('/health', healthRouter);
app.use('/api/sports', sportsRouter);
app.use('/api/slip', slipRouter);
app.use('/api/matches', matchesRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    demo: process.env.DATA_MODE === 'demo',
    sources: [],
    error: {
      code: 'not_found',
      message: 'Route not found'
    }
  });
});

// Error Handler
app.use(errorHandler);

module.exports = app;
