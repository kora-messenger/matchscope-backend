'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeEvent, LEAGUES } = require('../src/services/espnProvider');

const league = LEAGUES.find(l => l.espnPath === 'soccer/eng.1');

function makeEvent(overrides = {}) {
  return {
    id: '701234',
    date: '2026-10-10T11:30Z',
    season: { year: 2026 },
    status: { type: { state: 'pre', shortDetail: 'Scheduled' }, displayClock: "0'", period: 0 },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '359', displayName: 'Arsenal', logo: 'https://a.espncdn.com/x.png' } },
          { homeAway: 'away', score: '0', team: { id: '357', displayName: 'Leeds United', logo: 'https://a.espncdn.com/y.png' } }
        ]
      }
    ],
    ...overrides
  };
}

test('normalizes a pre-match event into an upcoming match', () => {
  const m = normalizeEvent(makeEvent(), league);
  assert.strictEqual(m.id, 'espn-701234');
  assert.strictEqual(m.sport, 'football');
  assert.strictEqual(m.status, 'upcoming');
  assert.strictEqual(m.score, null);
  assert.strictEqual(m.home_team.name, 'Arsenal');
  assert.strictEqual(m.away_team.id, 'espn-357');
  assert.strictEqual(m.home_team.logo, 'https://a.espncdn.com/x.png');
  assert.strictEqual(m.provenance.provider, 'ESPN');
});

test('normalizes a completed event with a score', () => {
  const ev = makeEvent({
    status: { type: { state: 'post', shortDetail: 'FT' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', score: '2', team: { id: '359', displayName: 'Arsenal' } },
          { homeAway: 'away', score: '1', team: { id: '357', displayName: 'Leeds United' } }
        ]
      }
    ]
  });
  const m = normalizeEvent(ev, league);
  assert.strictEqual(m.status, 'completed');
  assert.deepStrictEqual(m.score, { home: 2, away: 1 });
  assert.strictEqual(m.completed_time, m.start_time);
});

test('normalizes a live event with clock detail', () => {
  const ev = makeEvent({
    status: { type: { state: 'in', shortDetail: '62\'' }, displayClock: '62\'', period: 2 }
  });
  const m = normalizeEvent(ev, league);
  assert.strictEqual(m.status, 'live');
  assert.strictEqual(m.live_detail.clock, '62\'');
  assert.strictEqual(m.live_detail.period, 2);
});

test('rejects malformed events safely (null, never a partial match)', () => {
  assert.strictEqual(normalizeEvent(null, league), null);
  assert.strictEqual(normalizeEvent({}, league), null);
  assert.strictEqual(normalizeEvent({ id: 'x', date: 'nope', competitions: [] }, league), null);
  const missingAway = makeEvent();
  missingAway.competitions[0].competitors = [missingAway.competitions[0].competitors[0]];
  assert.strictEqual(normalizeEvent(missingAway, league), null);
});

test('never synthesizes a score for upcoming matches', () => {
  const ev = makeEvent(); // pre with score strings of '0'
  const m = normalizeEvent(ev, league);
  assert.strictEqual(m.status, 'upcoming');
  assert.strictEqual(m.score, null);
});
