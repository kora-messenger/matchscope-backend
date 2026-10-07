/**
 * Offline Sample Data for MatchScope AI Demo Mode
 * All records are strictly for demonstration/testing and explicitly flagged.
 * No sample record claims to be live or real-time data.
 */

const sampleSports = [
  {
    id: "football",
    name: "Football",
    category: "team",
    has_league_table: true,
    table_type: "points_standing",
    sample_leagues: ["English Premier League", "UEFA Champions League"]
  },
  {
    id: "basketball",
    name: "Basketball",
    category: "team",
    has_league_table: true,
    table_type: "win_loss_standing",
    sample_leagues: ["NBA Western Conference", "EuroLeague"]
  },
  {
    id: "tennis",
    name: "Tennis",
    category: "individual",
    has_league_table: false,
    table_type: "tour_ranking",
    sample_tours: ["ATP Singles Ranking", "WTA Singles Ranking"]
  }
];

const sampleMatches = [
  {
    id: "match-fb-101",
    sport: "football",
    league: "English Premier League",
    season: "2025/2026",
    status: "completed",
    start_time: "2026-09-20T15:00:00Z",
    completed_time: "2026-09-20T16:55:00Z",
    home_team: { id: "team-ars", name: "Arsenal" },
    away_team: { id: "team-che", name: "Chelsea" },
    score: { home: 2, away: 1 },
    is_demo_sample: true,
    data_notice: "Sample historic demo data"
  },
  {
    id: "match-fb-102",
    sport: "football",
    league: "English Premier League",
    season: "2025/2026",
    status: "upcoming",
    start_time: "2026-10-15T19:45:00Z",
    completed_time: null,
    home_team: { id: "team-mci", name: "Manchester City" },
    away_team: { id: "team-liv", name: "Liverpool" },
    score: null,
    is_demo_sample: true,
    data_notice: "Sample upcoming demo match"
  },
  {
    id: "match-bk-201",
    sport: "basketball",
    league: "NBA Western Conference",
    season: "2025/2026",
    status: "completed",
    start_time: "2026-09-25T01:00:00Z",
    completed_time: "2026-09-25T03:20:00Z",
    home_team: { id: "team-lal", name: "Los Angeles Lakers" },
    away_team: { id: "team-gsw", name: "Golden State Warriors" },
    score: { home: 112, away: 108 },
    is_demo_sample: true,
    data_notice: "Sample historic demo data"
  },
  {
    id: "match-bk-202",
    sport: "basketball",
    league: "NBA Western Conference",
    season: "2025/2026",
    status: "upcoming",
    start_time: "2026-10-20T02:00:00Z",
    completed_time: null,
    home_team: { id: "team-bos", name: "Boston Celtics" },
    away_team: { id: "team-mia", name: "Miami Heat" },
    score: null,
    is_demo_sample: true,
    data_notice: "Sample upcoming demo match"
  },
  {
    id: "match-tn-301",
    sport: "tennis",
    league: "ATP Masters 1000",
    season: "2026",
    status: "completed",
    start_time: "2026-09-28T12:00:00Z",
    completed_time: "2026-09-28T14:15:00Z",
    surface: "hard",
    home_team: { id: "player-sinner", name: "Jannik Sinner" },
    away_team: { id: "player-alcaraz", name: "Carlos Alcaraz" },
    score: { home: "6-4, 3-6, 6-3", away: "4-6, 6-3, 3-6" },
    is_demo_sample: true,
    data_notice: "Sample historic demo data"
  },
  {
    id: "match-tn-302",
    sport: "tennis",
    league: "ATP Masters 1000",
    season: "2026",
    status: "upcoming",
    start_time: "2026-10-18T14:00:00Z",
    completed_time: null,
    surface: "clay",
    home_team: { id: "player-djokovic", name: "Novak Djokovic" },
    away_team: { id: "player-medvedev", name: "Daniil Medvedev" },
    score: null,
    is_demo_sample: true,
    data_notice: "Sample upcoming demo match"
  }
];

const sampleStats = {
  "match-fb-101": {
    match_id: "match-fb-101",
    sport: "football",
    period_scores: {
      half_time: { home: 1, away: 0 },
      full_time: { home: 2, away: 1 }
    },
    metrics: {
      possession_pct: { home: 58, away: 42 },
      shots_on_target: { home: 7, away: 3 },
      shots_off_target: { home: 5, away: 4 },
      corners: { home: 6, away: 2 },
      fouls: { home: 11, away: 14 },
      yellow_cards: { home: 1, away: 3 },
      red_cards: { home: 0, away: 0 },
      // explicit null for unknown or unrecorded stat (NOT zero)
      expected_goals_xg: null,
      pass_accuracy_pct: null
    }
  },
  "match-fb-102": {
    match_id: "match-fb-102",
    sport: "football",
    period_scores: null,
    metrics: {
      possession_pct: null,
      shots_on_target: null,
      shots_off_target: null,
      corners: null,
      fouls: null,
      yellow_cards: null,
      red_cards: null,
      expected_goals_xg: null,
      pass_accuracy_pct: null
    },
    data_notice: "Upcoming match - statistics not yet available"
  },
  "match-bk-201": {
    match_id: "match-bk-201",
    sport: "basketball",
    period_scores: {
      q1: { home: 28, away: 26 },
      q2: { home: 30, away: 28 },
      q3: { home: 24, away: 29 },
      q4: { home: 30, away: 25 }
    },
    metrics: {
      field_goal_pct: { home: 48.5, away: 45.2 },
      three_point_pct: { home: 38.0, away: 34.5 },
      free_throw_pct: { home: 82.1, away: 78.0 },
      total_rebounds: { home: 44, away: 39 },
      assists: { home: 26, away: 22 },
      turnovers: { home: 11, away: 15 },
      steals: { home: 8, away: 5 },
      blocks: { home: 4, away: 3 },
      // Football specific stats are explicitly null/absent, not 0
      possession_pct: null,
      corners: null
    }
  },
  "match-tn-301": {
    match_id: "match-tn-301",
    sport: "tennis",
    sets: [
      { set_number: 1, score: { home: 6, away: 4 } },
      { set_number: 2, score: { home: 3, away: 6 } },
      { set_number: 3, score: { home: 6, away: 3 } }
    ],
    metrics: {
      aces: { home: 11, away: 8 },
      double_faults: { home: 2, away: 4 },
      first_serve_pct: { home: 68, away: 62 },
      first_serve_points_won_pct: { home: 76, away: 70 },
      break_points_saved: { home: "4/5", away: "2/5" },
      total_points_won: { home: 98, away: 86 },
      // League/football specific stats are null, unknown metric tracked as null
      unforced_errors: null
    }
  }
};

const sampleTables = {
  "football": {
    sport: "football",
    type: "league_standings",
    league: "English Premier League",
    season: "2025/2026",
    columns: ["rank", "team", "played", "won", "drawn", "lost", "goals_for", "goals_against", "points"],
    standings: [
      { rank: 1, team: "Arsenal", played: 6, won: 5, drawn: 1, lost: 0, goals_for: 14, goals_against: 3, points: 16 },
      { rank: 2, team: "Manchester City", played: 6, won: 4, drawn: 2, lost: 0, goals_for: 15, goals_against: 5, points: 14 },
      { rank: 3, team: "Liverpool", played: 6, won: 4, drawn: 1, lost: 1, goals_for: 12, goals_against: 6, points: 13 },
      { rank: 4, team: "Chelsea", played: 6, won: 3, drawn: 1, lost: 2, goals_for: 10, goals_against: 8, points: 10 }
    ]
  },
  "basketball": {
    sport: "basketball",
    type: "conference_standings",
    league: "NBA Western Conference",
    season: "2025/2026",
    columns: ["rank", "team", "wins", "losses", "win_pct", "games_behind"],
    standings: [
      { rank: 1, team: "Los Angeles Lakers", wins: 12, losses: 3, win_pct: 0.800, games_behind: 0 },
      { rank: 2, team: "Golden State Warriors", wins: 10, losses: 5, win_pct: 0.667, games_behind: 2.0 },
      { rank: 3, team: "Denver Nuggets", wins: 9, losses: 6, win_pct: 0.600, games_behind: 3.0 }
    ]
  },
  "tennis": {
    sport: "tennis",
    type: "atp_tour_rankings",
    tour: "ATP Tour Singles",
    as_of_date: "2026-09-28",
    data_note: "Tennis uses ATP/WTA Tour Rankings, not league points or match win/loss standings.",
    columns: ["rank", "player", "country", "points", "tournaments_played", "movement"],
    rankings: [
      { rank: 1, player: "Jannik Sinner", country: "ITA", points: 9890, tournaments_played: 18, movement: 0 },
      { rank: 2, player: "Carlos Alcaraz", country: "ESP", points: 8850, tournaments_played: 17, movement: 0 },
      { rank: 3, player: "Novak Djokovic", country: "SRB", points: 7260, tournaments_played: 14, movement: "+1" },
      { rank: 4, player: "Daniil Medvedev", country: "RUS", points: 6500, tournaments_played: 19, movement: "-1" }
    ]
  }
};

const samplePredictions = {
  "match-fb-102": {
    match_id: "match-fb-102",
    sport: "football",
    match_summary: "Manchester City vs Liverpool (Sample Match)",
    generated_at: "2026-09-30T10:00:00Z",
    engine: {
      name: "MatchScope-Demo-RuleEngine",
      version: "0.1.0-demo",
      is_live_llm: false,
      calibrated: false
    },
    uncalibrated_probabilities: {
      home_win: 0.48,
      draw: 0.27,
      away_win: 0.25
    },
    uncertainty: {
      level: "high",
      uncalibrated_score: 0.42,
      note: "Uncertainty score is heuristic and uncalibrated. Output represents synthetic rule analysis."
    },
    disclaimer: "Illustrative sample analysis only. No AI inference was performed. Uncalibrated probability output. No win guarantees provided.",
    reasoning_factors: [
      {
        factor: "Home Advantage",
        weight: "moderate",
        description: "Manchester City playing at home with strong historical sample home form."
      },
      {
        factor: "Head-to-Head Sample Trend",
        weight: "high",
        description: "Recent sample encounters show tight tactical matchups with high goal frequency."
      }
    ]
  },
  "match-tn-302": {
    match_id: "match-tn-302",
    sport: "tennis",
    match_summary: "Novak Djokovic vs Daniil Medvedev (Sample Match)",
    generated_at: "2026-09-30T10:00:00Z",
    engine: {
      name: "MatchScope-Demo-RuleEngine",
      version: "0.1.0-demo",
      is_live_llm: false,
      calibrated: false
    },
    uncalibrated_probabilities: {
      home_win: 0.58,
      away_win: 0.42
    },
    uncertainty: {
      level: "medium",
      uncalibrated_score: 0.30,
      note: "Uncertainty score is heuristic and uncalibrated. Output represents synthetic rule analysis."
    },
    disclaimer: "Illustrative sample analysis only. No AI inference was performed. Uncalibrated probability output. No win guarantees provided.",
    reasoning_factors: [
      {
        factor: "Surface Performance",
        weight: "high",
        description: "Djokovic historical win rate on clay in sample records."
      },
      {
        factor: "Rest & Conditioning",
        weight: "medium",
        description: "Both players entering tournament with equal recovery days in sample schedule."
      }
    ]
  }
};

module.exports = {
  sampleSports,
  sampleMatches,
  sampleStats,
  sampleTables,
  samplePredictions
};
