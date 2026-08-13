import riotApi from "./riot.ts"
import { callRiot } from "./riotQueue.ts"
import connection from "./redisConnection.ts"

const PUUID_CACHE_TTL_SECONDS = 6 * 60 * 60 // 6h — long enough to skip redundant lookups
// within a session, short enough that a
// renamed summoner won't stick around forever

function cacheKey(tokenIndex: number, summonerName: string): string {
  return `riot:puuid:${tokenIndex}:${summonerName.toLowerCase()}`
}

/**
 * puuids are encrypted per Riot API key and are NOT portable across tokens.
 * Any call going out on a token other than the one that originally resolved
 * identity must re-derive a puuid valid for *that* token via summoner name
 * before it can be used for match/mastery/rank lookups on that token.
 *
 * Cached in Redis per (tokenIndex, summonerName) to avoid burning a
 * summonerNameToId call on every enrichment/backfill run.
 */
export async function resolvePuuidForToken(tokenIndex: number, summonerName: string): Promise<string> {
  const key = cacheKey(tokenIndex, summonerName)

  const cached = await connection.get(key)
  if (cached) {
    return cached
  }

  const puuid = (await callRiot(tokenIndex, riotApi.prototype.summonerNameToId, summonerName)).puuid
  await connection.set(key, puuid, "EX", PUUID_CACHE_TTL_SECONDS)
  return puuid
}

/**
 * Call this if a summonerName rename is detected, or a token's mapping is
 * otherwise known to be stale, to force the next resolvePuuidForToken call
 * to hit the Riot API again.
 */
export async function invalidatePuuidCache(tokenIndex: number, summonerName: string): Promise<void> {
  await connection.del(cacheKey(tokenIndex, summonerName))
}