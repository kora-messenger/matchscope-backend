# MatchScope AI - Backend

MatchScope AI's backend API: sports data endpoints, the AI prediction engine
interface, and the real booking-code resolver (loads actual bookmaker slips for
the boom tools).

Runtime: Node.js 20, Express. Tests: `node --test`.

```
npm install
npm test
DATA_MODE=demo npm start
```

Endpoints:
- `GET /health`
- `GET /api/sports`
- `GET /api/matches?sport=...&status=...`
- `GET /api/matches/:id`, `/api/matches/:id/stats`, `/api/matches/:id/table`
- `GET /api/matches/:id/predictions`
- `POST /api/slip/resolve` - real booking-code lookup `{ bookmaker, code }`

Deployed on Render. See `render.yaml`.
