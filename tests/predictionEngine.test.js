'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Isolate the persisted ratings store per test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-engine-'));
process.env.MS_DATA_DIR = tmpDir;

const engine = require('../src/services/predictionEngine');

function completed(id, homeId, awayId, hs, as, sport = 'football', startTime = '2026-09-20T15:00:00Z') {
  return {
    id,
    sport,
    status: 'completed',
    start_time: startTime,
    home_team: { id: homeId, name: `Team ${homeId}` },
    away_team: { id: awayId, name: `Team ${awayId}` },
    score: { home: hs, away: as }
  };
}

function upcoming(id, homeId, awayId, sport = 'football') {
  return {
    id,
    sport,
    status: 'upcoming',
    start_time: '2026-10-10T15:00:00Z',
    home_team: { id: homeId, name: `Team ${homeId}` },
    away_team: { id: awayId, name: `Team ${awayId}` },
    score: null,
    league: 'Test League'
  };
}

test('expectedScore is a valid logistic curve', () => {
  const { expectedScore } = engine._internals;
  assert.strictEqual(expectedScore(1500, 1500), 0.5);
  assert.ok(expectedScore(1600, 1500) > 0.5);
  assert.ok(expectedScore(1400, 1500) < 0.5);
  assert.ok(Math.abs(expectedScore(1600, 1400) + expectedScore(1400, 1600) - 1) < 1e-9);
});

test('applyMatches updates Elo in the correct direction and is idempotent', () => {
  const matches = [completed('c1', 'A', 'B', 3, 0), completed('c2', 'A', 'B', 0, 3)];
  const n1 = engine.applyMatches(matches);
  assert.strictEqual(n1, 2);
  const n2 = engine.applyMatches(matches); // same ids, no-op
  assert.strictEqual(n2, 0);
});

test('football probabilities sum to 1 and include a draw', () => {
  const history = [
    completed('h1', 'A', 'B', 2, 1, 'football', '2026-09-01T15:00:00Z'),
    completed('h2', 'B', 'A', 1, 1, 'football', '2026-09-08T15:00:00Z'),
    completed('h3', 'A', 'C', 2, 0, 'football', '2026-09-15T15:00:00Z')
  ];
  engine.applyMatches(history);
  const pred = engine.predict(upcoming('u1', 'A', 'B'), history);
  assert.ok(pred, 'prediction should exist');
  const { home_win, draw, away_win } = pred.uncalibrated_probabilities;
  const sum = home_win + draw + away_win;
  assert.ok(Math.abs(sum - 1) < 0.01, `probabilities must sum to ~1, got ${sum}`);
  assert.ok(draw > 0.08, 'football must model draws');
  assert.strictEqual(pred.engine.name, 'matchscope-statmodel-v1');
  assert.ok(Array.isArray(pred.reasoning_factors) && pred.reasoning_factors.length > 0);
});

test('two-way sports have no draw and probabilities sum to 1', () => {
  const history = [
    completed('b1', 'X', 'Y', 110, 98, 'basketball', '2026-09-01T23:00:00Z'),
    completed('b2', 'Y', 'X', 100, 104, 'basketball', '2026-09-03T23:00:00Z'),
    completed('b3', 'X', 'Y', 121, 90, 'basketball', '2026-09-05T23:00:00Z')
  ];
  engine.applyMatches(history);
  const pred = engine.predict(upcoming('ub', 'X', 'Y', 'basketball'), history);
  assert.ok(pred);
  assert.strictEqual(pred.uncalibrated_probabilities.draw, 0);
  const sum = pred.uncalibrated_probabilities.home_win + pred.uncalibrated_probabilities.away_win;
  assert.ok(Math.abs(sum - 1) < 0.01);
  assert.strictEqual(pred.likely_score, undefined, 'no football score model for two-way sports');
});

test('stronger team gets higher win probability', () => {
  const history = [
    completed('s1', 'P', 'Q', 4, 0, 'football', '2026-09-01T15:00:00Z'),
    completed('s2', 'P', 'R', 3, 1, 'football', '2026-09-02T15:00:00Z'),
    completed('s3', 'P', 'S', 2, 0, 'football', '2026-09-03T15:00:00Z')
  ];
  engine.applyMatches(history);
  const pred = engine.predict(upcoming('us', 'P', 'Q'), history);
  assert.ok(pred.uncalibrated_probabilities.home_win > pred.uncalibrated_probabilities.away_win);
});

test('poisson likely score stays within a sane grid', () => {
  const { likelyScoreFootball } = engine._internals;
  const out = likelyScoreFootball(0);
  assert.ok(out.likely_score.home >= 0 && out.likely_score.home <= 6);
  assert.ok(out.likely_score.away >= 0 && out.likely_score.away <= 6);
  assert.ok(out.over_2_5_goals > 0 && out.over_2_5_goals < 1);
});

test('prediction is deterministic (same input, same output)', () => {
  const history = [completed('d1', 'M', 'N', 1, 0)];
  engine.applyMatches(history);
  const match = upcoming('ud', 'M', 'N');
  const a = engine.predict(match, history);
  const b = engine.predict(match, history);
  assert.deepStrictEqual(a.uncalibrated_probabilities, b.uncalibrated_probabilities);
});

test('completed matches get no prediction', () => {
  assert.strictEqual(engine.predict(completed('c9', 'A', 'B', 1, 1), []), null);
});
