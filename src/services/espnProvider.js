/**
 * ESPN Live Sports Provider
 *
 * Fetches real scoreboard data from ESPN's public site API (no API key required)
 * and normalizes it into the MatchScope provider contract with full provenance.
 *
 * Day-level cache strategy:
 *  - ESPN scoreboards only return one day per request (`?dates=YYYYMMDD`).
 *  - Every (league, day) response is cached in memory and persisted to disk
 *    (data/espn-day-cache.json) so restarts keep history.
 *  - Past days are stable: refetched at most every 12 hours.
 *  - Current/future days refresh every 10 minutes.
 *
 * This module owns NO prediction logic — it is a pure data source. The
 * MatchScope prediction engine consumes the normalized match list.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// League catalog: ESPN path -> MatchScope metadata
const LEAGUES = [
  // Football
  { espnPath: 'soccer/eng.1', sport: 'football', league: 'English Premier League', country: 'England' },
  { espnPath: 'soccer/esp.1', sport: 'football', league: 'Spanish LaLiga', country: 'Spain' },
  { espnPath: 'soccer/ita.1', sport: 'football', league: 'Italian Serie A', country: 'Italy' },
  { espnPath: 'soccer/ger.1', sport: 'football', league: 'German Bundesliga', country: 'Germany' },
  { espnPath: 'soccer/fra.1', sport: 'football', league: 'French Ligue 1', country: 'France' },
  { espnPath: 'soccer/uefa.champions', sport: 'football', league: 'UEFA Champions League', country: 'International' },
  { espnPath: 'soccer/uefa.europa', sport: 'football', league: 'UEFA Europa League', country: 'International' },
  { espnPath: 'soccer/uefa.wchampions', sport: 'football', league: 'UEFA Women\'s Champions League', country: 'International' },
  { espnPath: 'soccer/uefa.nations', sport: 'football', league: 'UEFA Nations League', country: 'International' },
  { espnPath: 'soccer/caf.nations_qual', sport: 'football', league: 'Africa Cup of Nations Qualification', country: 'Africa' },
  { espnPath: 'soccer/fifa.friendly', sport: 'football', league: 'International Friendly Games', country: 'International' },
  { espnPath: 'soccer/usa.1', sport: 'football', league: 'MLS', country: 'USA' },
  { espnPath: 'soccer/bra.1', sport: 'football', league: 'Brasileirão Série A', country: 'Brazil' },
  { espnPath: 'soccer/bra.2', sport: 'football', league: 'Brasileirão Série B', country: 'Brazil' },
  { espnPath: 'soccer/arg.1', sport: 'football', league: 'Argentine Liga Profesional', country: 'Argentina' },
  // Basketball
  { espnPath: 'basketball/nba', sport: 'basketball', league: 'NBA', country: 'USA' },
  // American football
  { espnPath: 'football/nfl', sport: 'american_football', league: 'NFL', country: 'USA' },
  // Ice hockey
  { espnPath: 'hockey/nhl', sport: 'ice_hockey', league: 'NHL', country: 'USA' },
  // Baseball
  { espnPath: 'baseball/mlb', sport: 'baseball', league: 'MLB', country: 'USA' }
];

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const PAST_DAYS = parseInt(process.env.ESPN_HISTORY_DAYS || '14', 10);
const FUTURE_DAYS = parseInt(process.env.ESPN_FIXTURE_DAYS || '5', 10);
const PAST_STALE_MS = 12 * 60 * 60 * 1000;
const FRESH_STALE_MS = 10 * 60 * 1000;
const DATA_DIR = process.env.MS_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'espn-day-cache.json');
const FETCH_CONCURRENCY = parseInt(process.env.ESPN_FETCH_CONCURRENCY || '8', 10);

let dayCache = null;      // { "soccer/eng.1|20261004": { ts, matches } }
let db = null;            // { builtAt, matches: [], byId: {} }
let refreshInFlight = null;

function loadDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (raw && typeof raw.entries === 'object') {
        dayCache = raw.entries;
      }
    }
  } catch (err) {
    dayCache = null;
  }
  if (!dayCache) dayCache = {};
}

function persistDiskCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ entries: dayCache }));
  } catch (err) {
    // Persistence is best-effort; in-memory cache still serves.
  }
}

function ymd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function dayList() {
  const days = [];
  const now = new Date();
  for (let i = PAST_DAYS; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(ymd(d));
  }
  days.push(ymd(now));
  for (let i = 1; i <= FUTURE_DAYS; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    days.push(ymd(d));
  }
  return days;
}

function isStale(entry, dayStr) {
  if (!entry) return true;
  const today = ymd(new Date());
  const ttl = dayStr >= today ? FRESH_STALE_MS : PAST_STALE_MS;
  return (Date.now() - entry.ts) > ttl;
}

async function fetchLeagueDay(league, dayStr) {
  const url = `${ESPN_BASE}/${league.espnPath}/scoreboard?dates=${dayStr}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.provider.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MatchScopeAI/1.0 (live data ingestion)' },
      compress: true
    });
    if (!res.ok) {
      throw new Error(`ESPN responded ${res.status}`);
    }
    const json = await res.json();
    const events = Array.isArray(json.events) ? json.events : [];
    const matches = [];
    for (const ev of events) {
      const m = normalizeEvent(ev, league);
      if (m) matches.push(m);
    }
    return { ts: Date.now(), matches };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize one ESPN scoreboard event into the MatchScope match contract.
 * Returns null for events we cannot represent safely.
 */
function normalizeEvent(ev, league) {
  if (!ev || typeof ev !== 'object' || typeof ev.date !== 'string') return null;
  const competition = Array.isArray(ev.competitions) ? ev.competitions[0] : null;
  if (!competition || !Array.isArray(competition.competitors)) return null;

  const home = competition.competitors.find(c => c.homeAway === 'home');
  const away = competition.competitors.find(c => c.homeAway === 'away');
  if (!home || !away || !home.team || !away.team) return null;

  const state = ev.status && typeof ev.status === 'object' && ev.status.type && ev.status.type.state;
  let status;
  if (state === 'pre') status = 'upcoming';
  else if (state === 'in') status = 'live';
  else if (state === 'post') status = 'completed';
  else return null;

  let score = null;
  if (status !== 'upcoming') {
    const hs = parseInt(home.score, 10);
    const as = parseInt(away.score, 10);
    if (!Number.isNaN(hs) && !Number.isNaN(as)) {
      score = { home: hs, away: as };
    }
  }

  const startTime = typeof ev.date === 'string' ? ev.date : null;
  if (!startTime) return null;

  return {
    id: `espn-${ev.id}`,
    sport: league.sport,
    league: league.league,
    country: league.country,
    season: ev.season && ev.season.year ? String(ev.season.year) : null,
    status,
    start_time: startTime,
    completed_time: status === 'completed' ? startTime : null,
    home_team: {
      id: `espn-${home.team.id}`,
      name: home.team.displayName || home.team.name,
      logo: home.team.logo || null
    },
    away_team: {
      id: `espn-${away.team.id}`,
      name: away.team.displayName || away.team.name,
      logo: away.team.logo || null
    },
    score,
    live_detail: status === 'live'
      ? {
          clock: ev.status.displayClock || null,
          period: ev.status.period || null,
          detail: ev.status.type && ev.status.type.shortDetail ? ev.status.type.shortDetail : null
        }
      : null,
    provenance: {
      provider: 'ESPN',
      feed_id: league.espnPath,
      fetched_at: new Date().toISOString(),
      data_timestamp: startTime
    }
  };
}

async function runPool(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = null;
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

/**
 * Refresh every stale (league, day) cell. Safe to call concurrently —
 * an in-flight refresh is shared.
 */
async function refresh(force = false) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    if (!dayCache) loadDiskCache();
    const days = dayList();
    const today = ymd(new Date());

    const tasks = [];
    const keys = [];
    for (const league of LEAGUES) {
      for (const day of days) {
        const key = `${league.espnPath}|${day}`;
        if (force || isStale(dayCache[key], day)) {
          keys.push(key);
          tasks.push(() => fetchLeagueDay(league, day));
        }
      }
    }
    if (tasks.length > 0) {
      const results = await runPool(tasks, FETCH_CONCURRENCY);
      results.forEach((r, i) => {
        if (r) dayCache[keys[i]] = r;
      });
      persistDiskCache();
    }
    buildDb();
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function buildDb() {
  const byId = {};
  const nowIso = new Date().toISOString();
  for (const [key, entry] of Object.entries(dayCache)) {
    for (const m of entry.matches) {
      const existing = byId[m.id];
      if (!existing || existing.status === 'upcoming' || m.status === 'live') {
        byId[m.id] = m;
      }
    }
  }
  const matches = Object.values(byId).sort((a, b) => {
    if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  db = {
    builtAt: nowIso,
    matches,
    byId
  };
}

function ensureReady() {
  if (!dayCache) {
    loadDiskCache();
    buildDb();
  }
}

/** Public API — returns the current DB, warming it on first use. */
async function getDb() {
  ensureReady();
  if (!db || db.matches.length === 0) {
    await refresh();
  } else {
    // Non-blocking freshness upkeep after the first warm pull.
    refresh().catch(() => {});
  }
  return db;
}

/** Synchronous access for the prediction engine (no network). */
function currentDb() {
  ensureReady();
  return db || { builtAt: null, matches: [], byId: {} };
}

module.exports = {
  LEAGUES,
  normalizeEvent,
  getDb,
  currentDb,
  refresh
};
