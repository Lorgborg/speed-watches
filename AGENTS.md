# AGENTS.md

League of Legends match tracker. Polls the Riot API for games, saves to PostgreSQL, exposes an Express API. No build step — everything runs via `tsx`.

## Commands

- `npm run api` — Express server on port 3000 (src/app.ts). `/api` routes, Swagger UI at `/docs` (from `documentation.yaml`).
- `npm run checker` — runs src/checker.ts: polls every user's recent games every 5 min, inserts new ones.
- `npm run worker` — starts the BullMQ workers (src/riot/riotWorker.ts) that execute all Riot API calls. Must be running for checker/backfill to work.
- `npm run lint` — ESLint (eslint.config.mjs).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test` / `npm run test:watch` — Vitest. `vitest.setup.ts` provides dummy env vars so tests run without a `.env` or live Postgres/Redis.
- `restart.sh` — deploy script (run on the server): kills+restarts tmux sessions `speed-watches-api`, `worker1`, `worker2`, `checker`. Two worker sessions means leagueApi2 and leagueApi3 are the active workers.

## Style

- Indentation: 2 spaces, no tabs. New files should use 2 spaces even where existing files are inconsistent.

## Imports

TypeScript `moduleResolution: nodenext` with `allowImportingTsExtensions` — **relative imports must include the `.ts` extension** (e.g. `import getOpponent from "./core/getOpponent.ts"`). Never write extensionless relative imports.

## Layout

- `src/checker.ts` — 5-min poller entrypoint.
- `src/app.ts` — Express app; `src/api/routes/index.ts` auto-loads route files.
- `src/api/` — API server code (routes, middleware, query builders, services).
- `src/riot/` — Riot client, BullMQ queue/worker, token + puuid resolution, Redis connection.
- `src/core/` — pure helper functions (getOpponent, getPlaying, idToChampion, getChampionPascal).
- `src/config/` — shared services (Postgres `sql`) and misc config helpers.
- `src/scripts/` — one-off scripts (immigrant-scum backfill).
- `src/types/` — shared type definitions (participant).
- Unit tests live next to the code they cover (`*.test.ts`).

## Riot token architecture (critical)

- Riot keys live in `.env` as `leagueApi1..leagueApi5`. `leagueApi1` is `MAIN_TOKEN_INDEX` (0), the others are worker tokens.
- **Puuid identity must ALWAYS resolve through `leagueApi1`** (`src/riot/resolveSummoner.ts`). It is the canonical puuid source; never create/look up users via worker tokens.
- **Puuids are encrypted per API key and are NOT portable across tokens.** `resolvePuuidForToken(tokenIndex, summonerName)` derives a puuid valid for a specific token (cached in Redis 6h; `invalidatePuuidCache` on rename). Only use a puuid on the token that resolved it.
- All Riot calls go through BullMQ queues via `callRiot(tokenIndex, riotApi.prototype.method, ...args)` — never call riotApi methods directly. `callRiot` times out after 60s and retries 8x.
- `pickWorkerTokenIndex()` round-robins worker tokens (leagueApi2+) via a Redis counter so load spreads across runs.
- Worker rate limits (src/riot/riotWorker.ts): 14 req/s per token, extra `riot:rl:{i}:long` window (100/120s), 429 → rate-limit + retry, **400 = unrecoverable** (not found, won't change), 409 → retried.

## Databases

- PostgreSQL: connection from `postgresuri` env (dotenv, `sql` tagged templates from the `postgres` package). `.env` missing → throws.
- Redis: `redisUri` env, shared single ioredis connection (src/riot/redisConnection.ts) for BullMQ + puuid cache + worker token counter. BullMQ requires `maxRetriesPerRequest: null`.
- Users table tracks `backfill_cursor` and `backfill_complete` for backfill; GAMES primary key is composite `id = gameId-puuid`. Postgres error `23505` = duplicate, skip and continue.

## Gotchas

- `.env` and `test.ts` are gitignored scratch/dev files — not part of the codebase.
- The Riot `aggregatorApi` key is used only in `src/scripts/immigrant-scum.ts` (one-time backfill of a user's match history); `leagueApi` in src/checker.ts is legacy/unused by workers.
- API routes are auto-loaded: `src/api/routes/index.ts` requires every `.ts` file in `src/api/routes/{get,post,remove,update}/`. Each file must default-export its own `express.Router()` that already defines method and path.
- `src/config/getLeagueKey.ts` is a mongo helper; mongo is not used by the main flows (checker/api run on Postgres).
