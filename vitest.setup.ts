// Runs before every test file.
// Modules read process.env at import time (e.g. services.ts throws if
// postgresuri is missing). There's no .env on CI, so provide dummy values.
process.env.DEV_API_KEY ??= "test-dev-key"
process.env.ADMIN_API_KEY ??= "test-admin-key"
process.env.leagueApi ??= "test-league-api"
process.env.leagueApi1 ??= "test-league-api-1"
process.env.aggregatorApi ??= "test-aggregator-api"
process.env.postgresuri ??= "postgres://test:test@localhost:5432/test"
process.env.redisUri ??= "redis://127.0.0.1:6379"
