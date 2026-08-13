// utils/riotTokens.ts
import "dotenv/config"
import connection from "./redisConnection.ts"

export function getRiotTokens(): string[] {
  const tokens: string[] = []
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`leagueApi${i}`]
    if (key) tokens.push(key)
  }
  if (tokens.length === 0) {
    throw new Error("No leagueApi1..leagueApi4 tokens found in .env")
  }
  return tokens
}

/**
 * leagueApi1 is the canonical puuid source. Any time we're creating a new
 * user or checking whether one already exists, we MUST resolve identity
 * through this token so every stored puuid comes from the same place.
 */
export const MAIN_TOKEN_INDEX = 0

/**
 * Round-robin token picker for everything that ISN'T identity resolution
 * (match history, timelines, mastery refreshes, backfill, etc). Draws only
 * from leagueApi2-4, persisted in Redis so load stays spread across runs.
 */
export async function pickWorkerTokenIndex(): Promise<number> {
  const tokenCount = getRiotTokens().length
  const workerCount = tokenCount - 1 // exclude leagueApi1
  if (workerCount <= 0) {
    // only one token configured, nothing to spread across
    return MAIN_TOKEN_INDEX
  }
  const next = await connection.incr("riot:next-worker-token-assignment")
  return 1 + ((next - 1) % workerCount)
}