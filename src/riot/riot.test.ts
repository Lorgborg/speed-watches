import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"
import riotApi from "./riot.ts"

describe("riotApi", () => {
  let getSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getSpy = vi.spyOn(axios, "get").mockReset().mockResolvedValue({ data: {}, status: 200 } as never)
  })

  it("throws when constructed without an api key", () => {
    expect(() => new riotApi(undefined)).toThrow()
  })

  it("sends the api key as the X-Riot-Token header", async () => {
    await new riotApi("test-key").matchIdToMatches("SG2_161017792")
    const config = getSpy.mock.calls[0][1] as { headers: Record<string, string> }
    expect(config.headers["X-Riot-Token"]).toBe("test-key")
  })

  it("splits a Name#TAG input for the riot account endpoint", async () => {
    await new riotApi("test-key").summonerNameToId("name#tag")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/name/tag"
    )
  })

  it("splits a #TAG passed via the id parameter", async () => {
    await new riotApi("test-key").summonerNameToId("name", "#TAG")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/name/TAG"
    )
  })

  it("throws when no tagLine is provided", () => {
    expect(() => new riotApi("test-key").summonerNameToId("name")).toThrow("No tagLine provided")
  })

  it("builds the mastery url on the sg2 region", async () => {
    await new riotApi("test-key").idToHighestMastery("puuid-1")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sg2.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/puuid-1/top"
    )
  })

  it("builds the match list url on the sea region with defaults", async () => {
    await new riotApi("test-key").idToMatch("puuid-1")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sea.api.riotgames.com/lol/match/v5/matches/by-puuid/puuid-1/ids?start=0&count=5"
    )
  })

  it("appends startTime/endTime when provided", async () => {
    await new riotApi("test-key").idToMatch("puuid-1", "10", 100, 200)
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sea.api.riotgames.com/lol/match/v5/matches/by-puuid/puuid-1/ids?start=0&count=10&startTime=200&endTime=100"
    )
  })

  it("builds the match details url", async () => {
    await new riotApi("test-key").matchIdToMatches("SG2_161017792")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sea.api.riotgames.com/lol/match/v5/matches/SG2_161017792"
    )
  })

  it("builds the summoner url on the sg2 region", async () => {
    await new riotApi("test-key").idToSummoner("puuid-1")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sg2.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/puuid-1"
    )
  })

  it("builds the current match url", async () => {
    await new riotApi("test-key").idToCurrentMatch("puuid-1")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sg2.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/puuid-1"
    )
  })

  it("builds the timeline url", async () => {
    await new riotApi("test-key").matchIdToMatchTimeLine("SG2_161017792")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sea.api.riotgames.com/lol/match/v5/matches/SG2_161017792/timeline"
    )
  })

  it("builds the rank url on the sg2 region", async () => {
    await new riotApi("test-key").idToRank("puuid-1")
    expect(getSpy.mock.calls[0][0]).toBe(
      "https://sg2.api.riotgames.com/lol/league/v4/entries/by-puuid/puuid-1"
    )
  })
})
