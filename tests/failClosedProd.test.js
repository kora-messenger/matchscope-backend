const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('Fail-Closed Default Mode: DATA_MODE!=demo fails closed with 503 data_provider_not_configured', async () => {
  process.env.DATA_MODE = 'prod';

  const endpoints = [
    '/api/sports',
    '/api/matches',
    '/api/matches/match-fb-101',
    '/api/matches/match-fb-101/stats',
    '/api/matches/match-fb-101/table',
    '/api/matches/match-fb-101/predictions'
  ];

  for (const endpoint of endpoints) {
    const res = await request(app).get(endpoint);
    assert.equal(res.status, 503, `Endpoint ${endpoint} should return 503 in production mode`);
    assert.equal(res.body.error.code, 'data_provider_not_configured');
    assert.match(res.body.error.message, /Data provider is not configured/i);
  }
});
