# MatchScope AI - Provider Interface & Architecture Design

## 1. Executive Overview

MatchScope AI is a multi-sport Android AI prediction application. This document specifies the provider interface contracts, domain rules, data provenance requirements, AI reasoning architecture, and security guidelines for integrating real-time sports data feeds and AI prediction providers.

---

## 2. Mode Architecture & Fail-Closed Strategy

### 2.1 Operating Modes
1. **Demo Mode (`DATA_MODE=demo`)**:
   - Opt-in explicit mode for demonstration, development, and mobile UI integration.
   - Every API response explicitly carries top-level fields:
     - `demo: true`
     - `sources: []`
   - Data is sourced strictly from offline static sample sets.
   - Sample data is explicitly labeled and timestamped; sample data is **never** presented as live or current real-time feeds.

2. **Production Mode (`DATA_MODE=prod` or unconfigured)**:
   - **Fail-Closed Policy**: By default, without active, authenticated third-party sports provider credentials, all data endpoints (`/api/sports`, `/api/matches`, etc.) fail closed with HTTP `503 Service Unavailable` and error code `data_provider_not_configured`.
   - Health check (`/health`) remains accessible and explicitly exposes system capability state (e.g. `sports_provider_configured: false`, `prediction_engine_configured: false`).

---

## 3. Data Provenance & Timestamps

All live and upstream provider feeds must supply explicit provenance metadata:

```json
{
  "provider": "ProviderName",
  "feed_id": "feed_xyz_9981",
  "fetched_at": "2026-09-30T11:42:00Z",
  "data_timestamp": "2026-09-30T11:40:00Z",
  "latency_ms": 120
}
```

### Match State Distinction
- **Completed Historical Matches**:
  - Must include `status: "completed"`, final `score`, `completed_time` (ISO 8601), and set/quarter/half breakdown.
- **Upcoming Matches**:
  - Must include `status: "upcoming"`, scheduled `start_time` (ISO 8601), and `score: null`.
  - Must **not** synthesize partial live scores or stats for upcoming games.

---

## 4. Sport Domain Rules & Data Integrity

### 4.1 Statistics Representation ("Unknown is NOT Zero")
- Missing, unrecorded, or untracked statistics MUST be represented as `null` (or omitted), NEVER as `0`.
- **Reasoning**: `0` represents an actual recorded metric (e.g., 0 yellow cards, 0 red cards). Using `0` for an unmeasured variable (e.g., untracked xG or possession in lower leagues) distorts AI statistical models and misinforms users.

Example:
```json
{
  "yellow_cards": { "home": 0, "away": 2 },
  "expected_goals_xg": null
}
```

### 4.2 Tennis Rankings vs. Team League Standings
- **Football & Basketball**: Use points/standing tables (`rank`, `played`, `won`, `drawn`, `lost`, `points`).
- **Tennis**: Uses individual ATP / WTA tour rankings (`rank`, `player`, `country`, `points`, `tournaments_played`, `movement`).
- Tennis matches DO NOT belong to a team league table with points or match record columns. Returning team league standings for tennis is strictly prohibited by domain rules.

---

## 5. AI Reasoning & Prediction Engine Contract

### 5.1 No Real LLM / Fake Backend Policy
- The production system does not make fake LLM calls or return ungrounded synthetic backend predictions.
- In Demo mode, rule-based synthetic predictions provide a structural representation of what the AI engine contract looks like when connected.

### 5.2 Uncalibrated Uncertainty & Win Guarantee Rules
- AI predictions MUST state that outputs are **uncalibrated probabilities**.
- Predictions MUST include an explicit disclaimer:
  > `"Demo AI analysis only. Uncalibrated probability output. No win guarantees provided."`
- Output structure example:

```json
{
  "demo": true,
  "sources": [],
  "data": {
    "match_id": "match-fb-102",
    "generated_at": "2026-09-30T11:42:00Z",
    "engine": {
      "name": "MatchScope-Engine",
      "version": "1.0.0",
      "calibrated": false
    },
    "uncalibrated_probabilities": {
      "home_win": 0.48,
      "draw": 0.27,
      "away_win": 0.25
    },
    "uncertainty": {
      "level": "high",
      "uncalibrated_score": 0.42
    },
    "disclaimer": "Demo AI analysis only. Uncalibrated probability output. No win guarantees provided."
  }
}
```

---

## 6. Security, Reliability & Timeout Patterns

1. **Parameter Bounds & Safe Validation**:
   - Query filters (`sport`, `status`, `limit`, `offset`) are strictly bounded and regex-validated.
   - Request path parameters (`:id`) are validated against regex `^[a-zA-Z0-9_-]{1,64}$`.
2. **Secret Masking & Error Sanitation**:
   - Internal stack traces, raw system errors, and provider API keys are NEVER exposed in response payloads.
3. **Upstream Timeout Pattern**:
   - Future provider calls must wrap upstream HTTP queries in a timeout wrapper (default 5000ms threshold):

```javascript
async function withTimeout(promise, timeoutMs = 5000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new DataProviderError('Upstream provider query timed out', 'provider_timeout', 504));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
```
