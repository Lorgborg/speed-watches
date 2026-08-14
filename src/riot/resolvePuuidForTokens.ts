import type { AxiosResponse } from "axios"
import { createHash } from "node:crypto"
import riotApi from "./riot.ts"
import { callRiot } from "./riotQueue.ts"
import { getRiotTokens } from "./riotTokens.ts"
import connection from "./redisConnection.ts"

const PUUID_CACHE_TTL_SECONDS = 6 * 60 * 60 // 6h — long enough to skip redundant lookups
// within a session, short enough that a
// renamed summoner won't stick around forever

// Riot encrypts puuids with the API key that resolved them, so a puuid is
// only valid under that specific key. If a key is ever regenerated, every
// cached puuid from the old key becomes garbage. Baking a short hash of the
// token into the cache key means a regenerated key automatically orphans its
// old entries — the next lookup is a cache miss and re-resolves against the
// new key, no manual Redis flush required. Long-lived keys are unaffected:
// the fingerprint stays constant while the token doesn't change.
function tokenFingerprint(token: string): string {
  return createHash("sha1").update(token).digest("hex").slice(0, 8)
}

export function buildPuuidCacheKey(tokenIndex: number, token: string, summonerName: string): string {
  return `riot:puuid:${tokenIndex}:${tokenFingerprint(token)}:${summonerName.toLowerCase()}`
}

function cacheKey(tokenIndex: number, summonerName: string): string {
  const token = getRiotTokens()[tokenIndex]
  if (!token) {
    throw new Error(`resolvePuuidForToken: no Riot token configured at index ${tokenIndex}`)
  }
  return buildPuuidCacheKey(tokenIndex, token, summonerName)
}

export function isDecryptError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? "")
  return /decrypt/i.test(message)
}

/**
 * puuids are encrypted per Riot API key and are NOT portable across tokens.
 * Any call going out on a token other than the one that originally resolved
 * identity must re-derive a puuid valid for *that* token via summoner name
 * before it can be used for match/mastery/rank lookups on that token.
 *
 * Cached in Redis per (token, summonerName) to avoid burning a
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

/**
 * Resolves the token-scoped puuid for a summoner, then runs a call with it.
 * If Riot rejects the puuid with a decrypt error, the cached entry is stale
 * (e.g. the key was rotated and the puuid belongs to the old key): clears it
 * and retries once with a freshly resolved puuid.
 */
export async function callRiotForSummoner<Args extends unknown[], R>(
  tokenIndex: number,
  summonerName: string,
  method: (this: riotApi, first: string, ...rest: Args) => Promise<AxiosResponse<R>>,
  ...rest: Args
): Promise<R> {
  const puuid = await resolvePuuidForToken(tokenIndex, summonerName)
  try {
    return await callRiot(tokenIndex, method, puuid, ...rest)
  } catch (e: unknown) {
    if (!isDecryptError(e)) throw e
    await invalidatePuuidCache(tokenIndex, summonerName)
    const freshPuuid = await resolvePuuidForToken(tokenIndex, summonerName)
    return await callRiot(tokenIndex, method, freshPuuid, ...rest)
  }
}
