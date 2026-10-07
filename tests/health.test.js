const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('GET /health - returns explicit capability state in prod mode', async () => {
  process.env.DATA_MODE = 'prod';
  const res = await request(app).get('/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.data_mode, 'prod');
  assert.equal(res.body.demo, false);
  assert.deepEqual(res.body.sources, []);
  assert.ok(res.body.capabilities);
  assert.equal(res.body.capabilities.demo_mode_active, false);
  assert.equal(res.body.capabilities.sports_provider_configured, false);
  assert.equal(res.body.capabilities.prediction_engine_configured, false);
});

test('GET /health - reflects demo mode when DATA_MODE=demo', async () => {
  process.env.DATA_MODE = 'demo';
  const res = await request(app).get('/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.data_mode, 'demo');
  assert.equal(res.body.demo, true);
  assert.equal(res.body.capabilities.demo_mode_active, true);
  process.env.DATA_MODE = 'prod'; // reset
});
