# LocalScore — Web (React + TypeScript + Vite)

Spectator + admin web client for the LocalScore platform.

## Stack
- React 18 + TypeScript + Vite
- TailwindCSS (design system) + Bootstrap 5 grid
- Redux Toolkit (auth) + React Query (server state)
- Socket.IO client (live updates)
- Recharts (Manhattan / worm analytics)
- React Router 6

## Develop
```bash
npm install
npm run dev      # http://localhost:5173  (proxies /api and /socket.io → :8000)
```
Run the backend (`docker compose up` at repo root) alongside it.

## Build
```bash
npm run build    # tsc --noEmit + vite build → dist/
npm run preview  # serve the production build locally
```

## Configuration
Copy `.env.example` → `.env`. In dev, leaving values unset uses the Vite proxy.
In production set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the backend origin.

## Structure
```
src/
  api/hooks.ts        React Query hooks (typed API)
  lib/api.ts          axios client + JWT refresh interceptor
  lib/socket.ts       Socket.IO singleton
  store/              Redux (auth slice)
  theme/              dark/light theme context
  hooks/              useLiveSocket, useTeamMap
  components/         Navbar, Layout, MatchCard, Spinner
  pages/              Dashboard, Teams, Tournaments, Login, Scoring, MatchCenter
  pages/matchcenter/  Live, Scorecard, Commentary, PlayingXI, Analytics, Prediction tabs
```

## Routes
- `/` dashboard · `/matches/:id` match center · `/teams` · `/teams/:id`
- `/tournaments` · `/tournaments/:id` · `/login`
- `/admin/matches/:id/score` ball-by-ball scoring (admin only)
