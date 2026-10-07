const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test.beforeEach(() => {
  process.env.DATA_MODE = 'demo';
});

test.afterEach(() => {
  process.env.DATA_MODE = 'prod';
});

test('Returns 400 Bad Request for invalid match ID format', async () => {
  const invalidIds = ['invalid!id@#', 'id with spaces', 'a'.repeat(100)];

  for (const id of invalidIds) {
    const res = await request(app).get(`/api/matches/${encodeURIComponent(id)}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'invalid_id_format');
  }
});

test('Returns 404 Not Found for unknown match ID', async () => {
  const endpoints = [
    '/api/matches/unknown-match-999',
    '/api/matches/unknown-match-999/stats',
    '/api/matches/unknown-match-999/table',
    '/api/matches/unknown-match-999/predictions'
  ];

  for (const endpoint of endpoints) {
    const res = await request(app).get(endpoint);
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  }
});

test('Returns 400 Bad Request for invalid query parameters', async () => {
  // Invalid sport
  const badSportRes = await request(app).get('/api/matches?sport=cricket');
  assert.equal(badSportRes.status, 400);

  // Invalid status
  const badStatusRes = await request(app).get('/api/matches?status=running');
  assert.equal(badStatusRes.status, 400);

  // Limit exceeding max cap
  const badLimitRes = await request(app).get('/api/matches?limit=100');
  assert.equal(badLimitRes.status, 400);

  // Negative offset
  const badOffsetRes = await request(app).get('/api/matches?offset=-5');
  assert.equal(badOffsetRes.status, 400);
});

test('Returns 404 Not Found for unknown routes', async () => {
  const res = await request(app).get('/api/non-existent-endpoint');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
});
