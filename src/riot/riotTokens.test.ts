import { describe, it, expect, vi, afterEach } from "vitest"

const mockIncr = vi.hoisted(() => vi.fn())
vi.mock("./redisConnection.ts", () => ({ default: { incr: mockIncr } }))

import { getRiotTokens, MAIN_TOKEN_INDEX, pickWorkerTokenIndex } from "./riotTokens.ts"

const TOKENS = ["t1", "t2", "t3", "t4", "t5"]

afterEach(() => {
  vi.unstubAllEnvs()
  mockIncr.mockReset()
})

function setTokens(count: number) {
  for (let i = 1; i <= 5; i++) {
    vi.stubEnv(`leagueApi${i}`, i <= count ? TOKENS[i - 1] : "")
  }
}

describe("getRiotTokens", () => {
  it("returns configured tokens in leagueApi order", () => {
    setTokens(4)
    expect(getRiotTokens()).toEqual(["t1", "t2", "t3", "t4"])
  })

  it("ignores empty token entries", () => {
    vi.stubEnv("leagueApi1", "t1")
    for (let i = 2; i <= 5; i++) vi.stubEnv(`leagueApi${i}`, "")
    expect(getRiotTokens()).toEqual(["t1"])
  })

  it("throws when no tokens are configured", () => {
    setTokens(0)
    expect(() => getRiotTokens()).toThrow("No leagueApi1")
  })
})

describe("pickWorkerTokenIndex", () => {
  it("MAIN_TOKEN_INDEX always resolves identity through leagueApi1", () => {
    expect(MAIN_TOKEN_INDEX).toBe(0)
  })

  it("falls back to the main token when only one token is configured", async () => {
    setTokens(1)
    await expect(pickWorkerTokenIndex()).resolves.toBe(0)
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it("round-robins across worker tokens (leagueApi2+)", async () => {
    setTokens(4)
    mockIncr.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4)
    await expect(pickWorkerTokenIndex()).resolves.toBe(1)
    await expect(pickWorkerTokenIndex()).resolves.toBe(2)
    await expect(pickWorkerTokenIndex()).resolves.toBe(3)
    await expect(pickWorkerTokenIndex()).resolves.toBe(1)
    expect(mockIncr).toHaveBeenCalledTimes(4)
    expect(mockIncr).toHaveBeenCalledWith("riot:next-worker-token-assignment")
  })
})
