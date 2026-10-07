const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`[MatchScope AI Backend] Listening on port ${config.port} (DATA_MODE: ${config.dataMode})`);
});

module.exports = server;
