const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('Credentials alone never advertise an implemented live feed or AI engine', async () => {
  process.env.DATA_MODE = 'prod';
  process.env.SPORTS_PROVIDER_BASE_URL = 'https://example.invalid';
  process.env.SPORTS_PROVIDER_API_KEY = 'synthetic-test-value';
  process.env.PREDICTION_ENGINE_API_KEY = 'synthetic-test-value';
  try {
    const response = await request(app).get('/health');
    assert.equal(response.body.capabilities.live_sports_feed_active, false);
    assert.equal(response.body.capabilities.ai_prediction_engine_active, false);
    assert.equal((await request(app).get('/api/matches')).status, 503);
  } finally {
    delete process.env.SPORTS_PROVIDER_BASE_URL;
    delete process.env.SPORTS_PROVIDER_API_KEY;
    delete process.env.PREDICTION_ENGINE_API_KEY;
  }
});
test('Completed fixtures do not generate retrospective pre-match picks', async () => {
  process.env.DATA_MODE = 'demo';
  const response = await request(app).get('/api/matches/match-fb-101/predictions');
  assert.equal(response.status, 200);
  assert.equal(response.body.demo, true);
  assert.equal(response.body.data.available, false);
  assert.equal(response.body.data.reason, 'match_completed');
});
test('Pagination rejects trailing junk, fractions and array inputs', async () => {
  process.env.DATA_MODE = 'demo';
  for (const query of ['limit=2junk', 'limit=1.5', 'offset=0junk', 'offset[]=1', 'limit=2&limit=3']) {
    assert.equal((await request(app).get('/api/matches?' + query)).status, 400, query);
  }
});
test('Validation error accurately labels production mode', async () => {
  process.env.DATA_MODE = 'prod';
  const response = await request(app).get('/api/matches?limit=bad');
  assert.equal(response.status, 400);
  assert.equal(response.body.demo, false);
});
