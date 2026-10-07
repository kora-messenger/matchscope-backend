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

test('GET /api/sports in demo mode returns list of sports with demo markers', async () => {
  const res = await request(app).get('/api/sports');

  assert.equal(res.status, 200);
  assert.equal(res.body.demo, true);
  assert.deepEqual(res.body.sources, []);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 3);

  const sports = res.body.data.map(s => s.id);
  assert.ok(sports.includes('football'));
  assert.ok(sports.includes('basketball'));
  assert.ok(sports.includes('tennis'));
});

test('GET /api/matches in demo mode returns filtered matches with demo markers', async () => {
  const res = await request(app).get('/api/matches?sport=football&status=completed');

  assert.equal(res.status, 200);
  assert.equal(res.body.demo, true);
  assert.deepEqual(res.body.sources, []);
  assert.ok(Array.isArray(res.body.data));

  for (const match of res.body.data) {
    assert.equal(match.sport, 'football');
    assert.equal(match.status, 'completed');
    assert.equal(match.is_demo_sample, true);
  }
});

test('GET /api/matches distinguishes completed historical vs upcoming matches', async () => {
  const completedRes = await request(app).get('/api/matches/match-fb-101');
  assert.equal(completedRes.status, 200);
  assert.equal(completedRes.body.data.status, 'completed');
  assert.ok(completedRes.body.data.score !== null);

  const upcomingRes = await request(app).get('/api/matches/match-fb-102');
  assert.equal(upcomingRes.status, 200);
  assert.equal(upcomingRes.body.data.status, 'upcoming');
  assert.equal(upcomingRes.body.data.score, null);
});

test('GET /api/matches/:id/stats ensures unknown/untracked stats are null, not zero', async () => {
  const res = await request(app).get('/api/matches/match-fb-101/stats');

  assert.equal(res.status, 200);
  assert.equal(res.body.demo, true);
  assert.deepEqual(res.body.sources, []);
  assert.ok(res.body.data.metrics);
  // Check that expected_goals_xg is strictly null (not 0)
  assert.strictEqual(res.body.data.metrics.expected_goals_xg, null);
});

test('GET /api/matches/:id/table respects domain rule (Tennis uses ATP rankings, not league points)', async () => {
  // Football table check
  const footballRes = await request(app).get('/api/matches/match-fb-101/table');
  assert.equal(footballRes.status, 200);
  assert.equal(footballRes.body.data.type, 'league_standings');
  assert.ok(footballRes.body.data.standings[0].points !== undefined);

  // Tennis table check
  const tennisRes = await request(app).get('/api/matches/match-tn-301/table');
  assert.equal(tennisRes.status, 200);
  assert.equal(tennisRes.body.data.type, 'atp_tour_rankings');
  assert.ok(tennisRes.body.data.rankings);
  // Verify tennis does not claim league points or team standings
  assert.equal(tennisRes.body.data.rankings[0].team, undefined);
  assert.ok(tennisRes.body.data.rankings[0].player);
  assert.ok(tennisRes.body.data.rankings[0].points);
});

test('GET /api/matches/:id/predictions returns uncalibrated uncertainty and win guarantee disclaimers', async () => {
  const res = await request(app).get('/api/matches/match-fb-102/predictions');

  assert.equal(res.status, 200);
  assert.equal(res.body.demo, true);
  assert.deepEqual(res.body.sources, []);
  assert.ok(res.body.data.uncalibrated_probabilities);
  assert.equal(res.body.data.engine.calibrated, false);
  assert.match(res.body.data.disclaimer, /No win guarantees provided/i);
});
