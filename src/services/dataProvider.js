const config = require('../config');
const {
  sampleSports,
  sampleMatches,
  sampleStats,
  sampleTables,
  samplePredictions
} = require('./sampleData');
const espnProvider = require('./espnProvider');
const predictionEngine = require('./predictionEngine');

class DataProviderError extends Error {
  constructor(message, code = 'data_provider_not_configured', statusCode = 503) {
    super(message);
    this.name = 'DataProviderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Timeout wrapper helper for future external provider integration.
 * Rejects after the timeout. Future network adapters must also use AbortController to cancel the underlying request.
 */
async function withTimeout(promise, timeoutMs = config.provider.timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new DataProviderError('Upstream provider query timed out', 'provider_timeout', 504));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function checkProviderConfigured() {
  if (config.isLiveMode()) return; // live provider requires no credentials
  if (!config.isDemoMode()) {
    throw new DataProviderError('Data provider is not configured for production mode', 'data_provider_not_configured', 503);
  }
}

function wrapLiveResponse(data, sources) {
  return {
    demo: false,
    sources: sources || [],
    data
  };
}

function liveProvenanceSources(db) {
  const providers = new Map();
  for (const m of db.matches) {
    const prov = m.provenance;
    if (prov) providers.set(prov.provider, { provider: prov.provider, fetched_at: db.builtAt });
  }
  return Array.from(providers.values());
}

function wrapResponse(data) {
  return {
    demo: true,
    sources: [],
    data
  };
}

async function getFixtureWindow(days = 5) {
  checkProviderConfigured();
  if (!config.isLiveMode()) {
    throw new DataProviderError('Fixture window is only available in live mode', 'data_provider_not_configured', 503);
  }
  const boundedDays = Math.min(7, Math.max(1, days));
  const db = await espnProvider.getDb();
  predictionEngine.applyMatches(db.matches);

  const now = new Date();
  const windowStartMs = now.getTime() - 24 * 60 * 60 * 1000; // include today's completed
  const windowEndMs = now.getTime() + boundedDays * 24 * 60 * 60 * 1000;

  const inWindow = db.matches.filter(m => {
    const t = Date.parse(m.start_time);
    if (Number.isNaN(t)) return false;
    return t >= windowStartMs && t <= windowEndMs;
  });

  return {
    demo: false,
    sources: liveProvenanceSources(db),
    data_points: {
      total_cached_matches: db.matches.length
    },
    built_at: db.builtAt,
    data: inWindow
  };
}

async function getSports() {
  checkProviderConfigured();
  if (config.isLiveMode()) {
    const db = await espnProvider.getDb();
    const sports = [];
    const seen = new Set();
    for (const lg of espnProvider.LEAGUES) {
      if (seen.has(lg.sport)) continue;
      seen.add(lg.sport);
      sports.push({ id: lg.sport, name: lg.sport.replace(/_/g, ' ') });
    }
    return wrapLiveResponse(sports, liveProvenanceSources(db));
  }
  return wrapResponse(sampleSports);
}

async function getMatches({ sport, status, limit = 20, offset = 0 } = {}) {
  checkProviderConfigured();

  if (config.isLiveMode()) {
    const db = await espnProvider.getDb();
    predictionEngine.applyMatches(db.matches);
    let filtered = [...db.matches];
    if (sport) filtered = filtered.filter(m => m.sport.toLowerCase() === sport.toLowerCase());
    if (status) filtered = filtered.filter(m => m.status.toLowerCase() === status.toLowerCase());
    filtered = filtered.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
    return {
      demo: false,
      sources: liveProvenanceSources(db),
      total: filtered.length,
      limit,
      offset,
      data: filtered.slice(offset, offset + limit)
    };
  }

  let filtered = [...sampleMatches];

  if (sport) {
    filtered = filtered.filter(m => m.sport.toLowerCase() === sport.toLowerCase());
  }

  if (status) {
    filtered = filtered.filter(m => m.status.toLowerCase() === status.toLowerCase());
  }

  const paginated = filtered.slice(offset, offset + limit);

  return {
    demo: true,
    sources: [],
    total: filtered.length,
    limit,
    offset,
    data: paginated
  };
}

async function getMatchById(id) {
  checkProviderConfigured();

  if (config.isLiveMode()) {
    const db = await espnProvider.getDb();
    predictionEngine.applyMatches(db.matches);
    const match = db.byId[id];
    if (!match) return null;
    return wrapLiveResponse(match, liveProvenanceSources(db));
  }

  const match = sampleMatches.find(m => m.id === id);
  if (!match) {
    return null;
  }

  return wrapResponse(match);
}

async function getMatchStats(id) {
  checkProviderConfigured();

  if (config.isLiveMode()) {
    const db = await espnProvider.getDb();
    predictionEngine.applyMatches(db.matches);
    const match = db.byId[id];
    if (!match) return null;
    const form = predictionEngine.getForm(match);
    return wrapLiveResponse({
      match_id: id,
      period_scores: match.live_detail ? { clock: match.live_detail.clock, period: match.live_detail.period, detail: match.live_detail.detail } : null,
      metrics: {
        possession_pct: null,
        shots_on_target: null,
        shots_off_target: null,
        corners: null,
        fouls: null,
        yellow_cards: null,
        red_cards: null,
        expected_goals_xg: null
      },
      form: form,
      data_notice: 'Scoreboard-level live feed. Detailed in-match statistics are not part of the current ingestion tier.'
    }, liveProvenanceSources(db));
  }

  const matchExists = sampleMatches.some(m => m.id === id);
  if (!matchExists) {
    return null;
  }

  const stats = sampleStats[id] || {
    match_id: id,
    period_scores: null,
    metrics: {
      possession_pct: null,
      shots_on_target: null,
      shots_off_target: null,
      corners: null,
      fouls: null,
      yellow_cards: null,
      red_cards: null,
      expected_goals_xg: null
    },
    data_notice: "Detailed statistics unavailable for this match"
  };

  return wrapResponse(stats);
}

async function getMatchTable(id) {
  checkProviderConfigured();

  if (config.isLiveMode()) {
    // Standings ingestion is a planned tier; live table returns null (404 handled by route).
    return null;
  }

  // Find match to determine sport
  const match = sampleMatches.find(m => m.id === id);
  if (!match) {
    return null;
  }

  const table = sampleTables[match.sport];
  if (!table) {
    return null;
  }

  return wrapResponse({
    match_id: id,
    ...table
  });
}

async function getMatchPredictions(id) {
  checkProviderConfigured();

  if (config.isLiveMode()) {
    const db = await espnProvider.getDb();
    predictionEngine.applyMatches(db.matches);
    const match = db.byId[id];
    if (!match) return null;
    if (match.status === 'completed') {
      return wrapLiveResponse({
        match_id: id,
        available: false,
        reason: 'match_completed',
        disclaimer: 'No retrospective pre-match prediction is generated.'
      }, liveProvenanceSources(db));
    }
    const prediction = predictionEngine.predict(match, db.matches);
    if (!prediction) return null;
    return wrapLiveResponse(prediction, [
      ...liveProvenanceSources(db),
      { provider: prediction.engine.name, fetched_at: prediction.generated_at }
    ]);
  }

  const match = sampleMatches.find(m => m.id === id);
  if (!match) {
    return null;
  }

  if (match.status === 'completed') {
    return wrapResponse({ match_id: id, available: false, reason: 'match_completed', disclaimer: 'No retrospective pre-match prediction is generated.' });
  }

  const prediction = samplePredictions[id] || {
    match_id: id,
    sport: match.sport,
    match_summary: `${match.home_team.name} vs ${match.away_team.name} (Sample Match)`,
    generated_at: new Date().toISOString(),
    engine: {
      name: "MatchScope-Demo-RuleEngine",
      version: "0.1.0-demo",
      is_live_llm: false,
      calibrated: false
    },
    uncalibrated_probabilities: {
      home_win: 0.50,
      away_win: 0.50
    },
    uncertainty: {
      level: "high",
      uncalibrated_score: 0.50,
      note: "Default demo uncalibrated distribution due to limited sample historical data."
    },
    disclaimer: "Illustrative sample analysis only. No AI inference was performed. Uncalibrated probability output. No win guarantees provided.",
    reasoning_factors: [
      {
        factor: "Sample Even Matchup",
        weight: "neutral",
        description: "Balanced baseline sample stats."
      }
    ]
  };

  return wrapResponse(prediction);
}

module.exports = {
  DataProviderError,
  withTimeout,
  getSports,
  getMatches,
  getFixtureWindow,
  getMatchById,
  getMatchStats,
  getMatchTable,
  getMatchPredictions
};
