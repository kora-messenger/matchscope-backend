const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

const { resolveBookingCode, normalizeBookmakerName } = require('../src/services/bookingCodeResolver');

// --- Service: input validation -------------------------------------------------

test('rejects unsupported bookmakers with a clear error', async () => {
  await assert.rejects(
    () => resolveBookingCode({ bookmaker: 'Bet9ja', code: 'ABC123' }),
    (err) => err.code === 'unsupported_bookmaker' && err.statusCode === 400
  );
});

test('normalizes SportyBet aliases', () => {
  assert.equal(normalizeBookmakerName('SportyBet'), 'sportybet');
  assert.equal(normalizeBookmakerName('sportybet ng'), 'sportybet');
  assert.equal(normalizeBookmakerName('Sporty-Bet'), 'sportybet');
});

test('rejects malformed codes before any upstream call', async () => {
  await assert.rejects(
    () => resolveBookingCode({ bookmaker: 'SportyBet', code: 'ab' }),
    (err) => err.code === 'invalid_code_format'
  );
  await assert.rejects(
    () => resolveBookingCode({ bookmaker: 'SportyBet', code: 'not a code!!' }),
    (err) => err.code === 'invalid_code_format'
  );
});

// --- Service: SportyBet resolution (stubbed upstream) --------------------------

function sportyBetSuccessBody() {
  return {
    bizCode: 10000,
    message: 'success',
    data: {
      ticket: {
        selections: [
          { eventId: 'sr:match:1', marketId: 'm1', outcomeId: 'o1' },
          { eventId: 'sr:match:2', marketId: 'm2', outcomeId: 'o3' },
        ],
      },
      outcomes: [
        {
          eventId: 'sr:match:1',
          homeTeamName: 'Arsenal',
          awayTeamName: 'Chelsea',
          estimateStartTime: '1791300000000',
          sport: { category: { name: 'England', tournament: { name: 'Premier League' } } },
          markets: [{ id: 'm1', title: '1X2', desc: 'Match Result', outcomes: [{ id: 'o1', desc: 'Home Win', odds: 1.85 }] }],
        },
        {
          eventId: 'sr:match:2',
          homeTeamName: 'Real Madrid',
          awayTeamName: 'Barcelona',
          estimateStartTime: '1791303600000',
          sport: { category: { name: 'Spain', tournament: { name: 'LaLiga' } } },
          markets: [{ id: 'm2', title: 'Over/Under', desc: 'Over/Under 2.5', outcomes: [{ id: 'o3', desc: 'Over 2.5', odds: 1.72 }] }],
        },
      ],
    },
  };
}

function stubFetcher(body, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
}

test('resolves a SportyBet code into normalized selections with odds', async () => {
  const result = await resolveBookingCode(
    { bookmaker: 'SportyBet', code: 'ab12cd' },
    { fetcher: stubFetcher(sportyBetSuccessBody()) }
  );

  assert.equal(result.bookmaker, 'SportyBet');
  assert.equal(result.code, 'AB12CD');
  assert.equal(result.selections.length, 2);

  const first = result.selections[0];
  assert.equal(first.match, 'Arsenal vs Chelsea');
  assert.equal(first.league, 'England · Premier League');
  assert.equal(first.market, 'Match Result');
  assert.equal(first.selection, 'Home Win');
  assert.equal(first.odds, 1.85);
  assert.equal(first.kickoff, new Date(1791300000000).toISOString());

  assert.equal(result.totalOdds, Math.round(1.85 * 1.72 * 100) / 100);
});

test('maps SportyBet invalid-code responses to code_not_found (404)', async () => {
  await assert.rejects(
    () =>
      resolveBookingCode(
        { bookmaker: 'SportyBet', code: 'deadcod' },
        { fetcher: stubFetcher({ bizCode: 19000, isAvailable: true, innerMsg: 'The code is invalid.', message: 'The code is invalid.' }) }
      ),
    (err) => err.code === 'code_not_found' && err.statusCode === 404
  );
});

test('maps upstream HTTP failures to upstream_error (502)', async () => {
  await assert.rejects(
    () =>
      resolveBookingCode(
        { bookmaker: 'SportyBet', code: 'ab12cd' },
        { fetcher: stubFetcher({ error: 'nope' }, 403) }
      ),
    (err) => err.code === 'upstream_error' && err.statusCode === 502
  );
});

test('maps fetch exceptions to upstream_unreachable (502)', async () => {
  await assert.rejects(
    () =>
      resolveBookingCode(
        { bookmaker: 'SportyBet', code: 'ab12cd' },
        { fetcher: async () => { throw new Error('ECONNRESET'); } }
      ),
    (err) => err.code === 'upstream_unreachable' && err.statusCode === 502
  );
});

// --- Route: request validation + error shapes -----------------------------------

test('POST /api/slip/resolve requires a bookmaker and a code', async () => {
  const missingBookmaker = await request(app).post('/api/slip/resolve').send({ code: 'ABC123' });
  assert.equal(missingBookmaker.status, 400);
  assert.equal(missingBookmaker.body.error.code, 'invalid_request');

  const missingCode = await request(app).post('/api/slip/resolve').send({ bookmaker: 'SportyBet' });
  assert.equal(missingCode.status, 400);
  assert.equal(missingCode.body.error.code, 'invalid_request');
});

test('POST /api/slip/resolve returns unsupported_bookmaker for non-SportyBet bookies', async () => {
  const res = await request(app).post('/api/slip/resolve').send({ bookmaker: 'Bet9ja', code: 'ABC123' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'unsupported_bookmaker');
});

test('POST /api/slip/resolve returns invalid_code_format for junk codes', async () => {
  const res = await request(app).post('/api/slip/resolve').send({ bookmaker: 'SportyBet', code: '!!no!!' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'invalid_code_format');
});
