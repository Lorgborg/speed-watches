import { describe, it, expect, vi, beforeEach } from "vitest"

const mockConnection = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))
const mockCallRiot = vi.hoisted(() => vi.fn())

vi.mock("./redisConnection.ts", () => ({ default: mockConnection }))
vi.mock("./riotQueue.ts", () => ({ callRiot: mockCallRiot }))
vi.mock("./riotTokens.ts", () => ({
  getRiotTokens: () => ["leagueApi1", "leagueApi2", "leagueApi3", "leagueApi4", "leagueApi5"],
}))

import riotApi from "./riot.ts"
import {
  resolvePuuidForToken,
  invalidatePuuidCache,
  buildPuuidCacheKey,
  isDecryptError,
  callRiotForSummoner,
} from "./resolvePuuidForTokens.ts"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolvePuuidForToken", () => {
  it("returns the cached puuid without hitting the Riot API", async () => {
    mockConnection.get.mockResolvedValue("cached-puuid")
    await expect(resolvePuuidForToken(2, "SummonerName")).resolves.toBe("cached-puuid")
    expect(mockConnection.get).toHaveBeenCalledWith(expect.stringContaining("riot:puuid:2:"))
    expect(mockConnection.get).toHaveBeenCalledWith(expect.stringContaining(":summonername"))
    expect(mockCallRiot).not.toHaveBeenCalled()
  })

  it("resolves and caches a puuid on a cache miss", async () => {
    mockConnection.get.mockResolvedValue(null)
    mockCallRiot.mockResolvedValue({ puuid: "fresh-puuid" })
    await expect(resolvePuuidForToken(2, "SummonerName")).resolves.toBe("fresh-puuid")
    expect(mockCallRiot).toHaveBeenCalledWith(2, riotApi.prototype.summonerNameToId, "SummonerName")
    expect(mockConnection.set).toHaveBeenCalledWith(
      expect.stringContaining("riot:puuid:2:"),
      "fresh-puuid",
      "EX",
      21600
    )
  })

  it("uses a different cache key when the token at an index changes (key rotation)", () => {
    const oldKey = buildPuuidCacheKey(2, "leagueApi2", "Name")
    const newKey = buildPuuidCacheKey(2, "leagueApi3", "Name")
    expect(newKey).not.toBe(oldKey)
  })
})

describe("invalidatePuuidCache", () => {
  it("deletes the per-token cache key", async () => {
    mockConnection.del.mockResolvedValue(1)
    await invalidatePuuidCache(2, "SummonerName")
    expect(mockConnection.del).toHaveBeenCalledWith(expect.stringContaining("riot:puuid:2:"))
  })
})

describe("callRiotForSummoner", () => {
  it("resolves the puuid, calls, and returns the data", async () => {
    mockConnection.get.mockResolvedValue("puuid-2")
    mockCallRiot.mockResolvedValue({ matches: [] })
    const result = await callRiotForSummoner(2, "Name", riotApi.prototype.idToMatch, "5")
    expect(mockCallRiot).toHaveBeenCalledWith(2, riotApi.prototype.idToMatch, "puuid-2", "5")
    expect(result).toEqual({ matches: [] })
  })

  it("invalidates and retries once when Riot reports a decrypt error", async () => {
    mockConnection.get.mockResolvedValueOnce("stale-puuid").mockResolvedValueOnce("fresh-puuid")
    mockConnection.del.mockResolvedValue(1)
    mockCallRiot
      .mockRejectedValueOnce(new Error("Bad Request - Exception decrypting puuid ..."))
      .mockResolvedValueOnce({ matches: [] })

    const result = await callRiotForSummoner(2, "Name", riotApi.prototype.idToMatch, "5")

    expect(mockConnection.del).toHaveBeenCalledTimes(1)
    expect(mockCallRiot).toHaveBeenNthCalledWith(1, 2, riotApi.prototype.idToMatch, "stale-puuid", "5")
    expect(mockCallRiot).toHaveBeenNthCalledWith(2, 2, riotApi.prototype.idToMatch, "fresh-puuid", "5")
    expect(result).toEqual({ matches: [] })
  })

  it("does not invalidate the cache for non-decrypt errors", async () => {
    mockConnection.get.mockResolvedValue("puuid-2")
    mockCallRiot.mockRejectedValue(new Error("Riot API 429 (rate limited)"))
    await expect(callRiotForSummoner(2, "Name", riotApi.prototype.idToMatch, "5")).rejects.toThrow("429")
    expect(mockCallRiot).toHaveBeenCalledTimes(1)
    expect(mockConnection.del).not.toHaveBeenCalled()
  })
})

describe("isDecryptError", () => {
  it("matches Riot decrypt errors and ignores others", () => {
    expect(isDecryptError(new Error("Bad Request - Exception decrypting puuid abc"))).toBe(true)
    expect(isDecryptError(new Error("Riot API 429 (rate limited)"))).toBe(false)
  })
})
