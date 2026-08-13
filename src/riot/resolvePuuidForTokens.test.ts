import { describe, it, expect, vi, beforeEach } from "vitest"

const mockConnection = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))
const mockCallRiot = vi.hoisted(() => vi.fn())

vi.mock("./redisConnection.ts", () => ({ default: mockConnection }))
vi.mock("./riotQueue.ts", () => ({ callRiot: mockCallRiot }))

import { resolvePuuidForToken, invalidatePuuidCache } from "./resolvePuuidForTokens.ts"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolvePuuidForToken", () => {
  it("returns the cached puuid without hitting the Riot API", async () => {
    mockConnection.get.mockResolvedValue("cached-puuid")
    await expect(resolvePuuidForToken(2, "SummonerName")).resolves.toBe("cached-puuid")
    expect(mockConnection.get).toHaveBeenCalledWith("riot:puuid:2:summonername")
    expect(mockCallRiot).not.toHaveBeenCalled()
  })

  it("resolves and caches a puuid on a cache miss", async () => {
    mockConnection.get.mockResolvedValue(null)
    mockCallRiot.mockResolvedValue({ puuid: "fresh-puuid" })
    await expect(resolvePuuidForToken(2, "SummonerName")).resolves.toBe("fresh-puuid")
    expect(mockCallRiot).toHaveBeenCalled()
    expect(mockConnection.set).toHaveBeenCalledWith(
      "riot:puuid:2:summonername",
      "fresh-puuid",
      "EX",
      21600
    )
  })
})

describe("invalidatePuuidCache", () => {
  it("deletes the per-token cache key", async () => {
    mockConnection.del.mockResolvedValue(1)
    await invalidatePuuidCache(2, "SummonerName")
    expect(mockConnection.del).toHaveBeenCalledWith("riot:puuid:2:summonername")
  })
})
