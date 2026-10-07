/**
 * Real booking-code resolver.
 *
 * Loads a slip's actual selections (games, markets, selections, odds) from the
 * bookmaker that issued the booking code, so the boom tools can operate on
 * real slips instead of MatchScope's internal pick codes.
 *
 * Design follows the backend foundation's rules:
 *  - fails closed with typed errors (never leaks internals),
 *  - upstream calls are proxied through this backend (the app never talks to
 *    the bookmaker directly),
 *  - the provider set is explicit; unsupported bookmakers are rejected with
 *    a clear error rather than a guess.
 */

const config = require('../config');

const BOOKMAKER_TIMEOUT_MS = 8000;

class BookingCodeError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'BookingCodeError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Supported bookmakers. Keys are normalized (lowercase) names; entry holds the
 * display name and the code format each bookie actually issues.
 */
const SUPPORTED_BOOKMAKERS = {
  sportybet: {
    name: 'SportyBet',
    // SportyBet share codes: 5-14 alphanumerics, case-preserved.
    codePattern: /^[A-Za-z0-9]{5,14}$/,
  },
};

function normalizeBookmakerName(input) {
  const cleaned = String(input || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  // Common aliases so "SportyBet", "sportybet ng", "sporty-bet" all resolve.
  if (cleaned === 'sportybet' || cleaned === 'sportybetng' || cleaned === 'sporty') return 'sportybet';
  return cleaned;
}

// Browser-like headers verified against the SportyBet web API (their edge
// rejects non-browser requests with a CloudFront 403).
const SPORTYBET_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  Origin: 'https://www.sportybet.com',
  Referer: 'https://www.sportybet.com/ng/',
};

function defaultFetcher(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(options.timeoutMs || BOOKMAKER_TIMEOUT_MS) });
}

/**
 * SportyBet share codes are served by:
 *   GET https://www.sportybet.com/api/ng/orders/share/{code}?_t={now}
 * Success shape (JSON; the same payload exists as XML when requested with an
 * XML Accept header):
 *   { bizCode: 10000, message: "success", data: {
 *       ticket: { selections: [{ eventId, marketId, outcomeId, specifier, ... }] },
 *       outcomes: [ { eventId, homeTeamName, awayTeamName, estimateStartTime,
 *                     sport: { category: { name, tournament: { name } } },
 *                     markets: [ { id, title, desc,
 *                                  outcomes: [ { id, desc, odds } ] } ] } ] } }
 */
function normalizeSportyBetPayload(j, code) {
  const data = j && typeof j === 'object' ? j.data : null;
  if (!data) {
    throw new BookingCodeError('upstream_error', 'Bookmaker response did not contain slip data.', 502);
  }

  const rawOutcomes = Array.isArray(data.outcomes) ? data.outcomes : [];
  const ticket = data.ticket || {};
  const rawSelections = Array.isArray(ticket.selections)
    ? ticket.selections
    : Array.isArray(ticket.selections && ticket.selections.selections)
      ? ticket.selections.selections
      : [];

  if (!rawOutcomes.length || !rawSelections.length) {
    throw new BookingCodeError('code_not_found', 'This booking code has no selections or has expired.', 404);
  }

  // Index outcome blocks by event id so each booked selection finds its game.
  const outcomesByEvent = new Map();
  for (const o of rawOutcomes) {
    const eventId = o && (o.eventId != null ? o.eventId : o.id);
    if (eventId != null) outcomesByEvent.set(String(eventId), o);
  }

  const selections = rawSelections.map((sel, index) => {
    const outcome = outcomesByEvent.get(String(sel.eventId)) || {};
    const entry = sportyBetSelectionFromOutcome(outcome, sel, index, code);
    if (!entry.match) {
      throw new BookingCodeError('upstream_error', 'Bookmaker response was missing event details.', 502);
    }
    return entry;
  });

  return selections;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.selections)) return value.selections;
  // Some payloads wrap arrays in a same-named object (XML conversion artifacts).
  if (value && Array.isArray(value.markets)) return [value];
  return [];
}

function firstMarketOf(outcome) {
  const markets = asArray(outcome.markets);
  return markets.length ? markets[0] : null;
}

function firstOutcomeOf(market) {
  if (!market) return null;
  const outcomes = asArray(market.outcomes);
  return outcomes.length ? outcomes[0] : null;
}

function sportyBetSelectionFromOutcome(outcome, sel, index, code) {
  const home = outcome.homeTeamName || outcome.homeTeam || '';
  const away = outcome.awayTeamName || outcome.awayTeam || '';

  const sport = outcome.sport || {};
  const category = sport.category || {};
  const tournament = category.tournament || {};
  const league = [category.name, tournament.name].filter(Boolean).join(' · ') || 'Football';

  const kickoffMillis = Number.parseInt(String(outcome.estimateStartTime || ''), 10);
  const kickoff = Number.isFinite(kickoffMillis)
    ? new Date(kickoffMillis).toISOString()
    : null;

  // Prefer the exact booked market/outcome; fall back to the event's first
  // market/outcome when the payload does not expose the tree.
  const markets = asArray(outcome.markets);
  const bookedMarket = markets.find((m) => String(m.id) === String(sel.marketId)) || firstMarketOf(outcome);
  const bookedOutcome = bookedMarket
    ? asArray(bookedMarket.outcomes).find((o) => String(o.id) === String(sel.outcomeId)) || firstOutcomeOf(bookedMarket)
    : null;

  const market = (bookedMarket && (bookedMarket.desc || bookedMarket.title || bookedMarket.name)) || sel.specifier || 'Market';
  const selection =
    (bookedOutcome && (bookedOutcome.desc || bookedOutcome.name)) || sel.specifier || `Selection ${index + 1}`;
  const oddsRaw = bookedOutcome ? bookedOutcome.odds : null;
  const odds = Number(oddsRaw) > 0 ? Number(oddsRaw) : null;

  return {
    eventId: String(sel.eventId || outcome.eventId || `${code}-${index}`),
    match: home && away ? `${home} vs ${away}` : '',
    home,
    away,
    league,
    kickoff,
    market,
    selection,
    odds,
  };
}

async function resolveSportyBet(code, { fetcher = defaultFetcher, timeoutMs = BOOKMAKER_TIMEOUT_MS } = {}) {
  const normalized = String(code).trim().toUpperCase();
  const url = `https://www.sportybet.com/api/ng/orders/share/${encodeURIComponent(normalized)}?_t=${Date.now()}`;
  let response;
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: SPORTYBET_REQUEST_HEADERS,
      timeoutMs,
    });
  } catch (err) {
    throw new BookingCodeError('upstream_unreachable', 'Could not reach the bookmaker. Try again shortly.', 502);
  }

  if (!response.ok) {
    throw new BookingCodeError('upstream_error', 'Bookmaker rejected the lookup. Try again shortly.', 502);
  }

  const body = await response.text();
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) {
    // XML or HTML body: not the JSON payload we asked for.
    throw new BookingCodeError('upstream_error', 'Unexpected bookmaker response format.', 502);
  }

  let j;
  try {
    j = JSON.parse(trimmed);
  } catch (err) {
    throw new BookingCodeError('upstream_error', 'Unexpected bookmaker response format.', 502);
  }

  const bizCode = j.bizCode;
  const message = String(j.message || j.innerMsg || '');
  const success = bizCode === 10000 || message.toLowerCase() === 'success';
  if (!success) {
    const invalid = /invalid|not exist|expire/i.test(message) || bizCode === 19000;
    throw new BookingCodeError(
      'code_not_found',
      invalid ? 'This booking code is invalid or has expired.' : message || 'Booking code lookup failed.',
      404
    );
  }

  return normalizeSportyBetPayload(j, normalized);
}

/**
 * Resolve a real booking code into its selections.
 *
 * @param {object} input { bookmaker, code }
 * @param {object} deps  optional { fetcher, timeoutMs } for tests
 * @returns {Promise<{bookmaker:string, code:string, selections:Array, totalOdds:number, resolvedAt:string}>}
 */
async function resolveBookingCode(input, deps = {}) {
  const bookmakerKey = normalizeBookmakerName(input && input.bookmaker);
  const provider = SUPPORTED_BOOKMAKERS[bookmakerKey];
  if (!provider) {
    throw new BookingCodeError(
      'unsupported_bookmaker',
      `Live code loading is not available for "${input && input.bookmaker}" yet. Supported: SportyBet.`,
      400
    );
  }

  const code = String((input && input.code) || '').trim();
  if (!code || !provider.codePattern.test(code)) {
    throw new BookingCodeError('invalid_code_format', 'That does not look like a valid booking code.', 400);
  }

  const selections =
    bookmakerKey === 'sportybet' ? await resolveSportyBet(code, deps) : null;
  if (!selections || !selections.length) {
    throw new BookingCodeError('code_not_found', 'This booking code is invalid or has expired.', 404);
  }

  const totalOdds = selections.reduce((acc, s) => acc * (s.odds || 1), 1);
  return {
    bookmaker: provider.name,
    code: bookmakerKey === 'sportybet' ? code.toUpperCase() : code,
    selections,
    totalOdds: Math.round(totalOdds * 100) / 100,
    resolvedAt: new Date().toISOString(),
  };
}

module.exports = {
  resolveBookingCode,
  BookingCodeError,
  SUPPORTED_BOOKMAKERS,
  normalizeBookmakerName,
};
