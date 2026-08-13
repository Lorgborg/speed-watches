import { describe, it, expect, vi } from "vitest"
import getPlaying from "./getPlaying.ts"
import type Participant from "../types/participant.ts"

function makeParticipant(overrides: Partial<Participant>): Participant {
  return {
    puuid: "p1",
    championName: "Ahri",
    ...overrides,
  } as Participant
}

describe("getPlaying", () => {
  it("returns the participant matching the puuid", () => {
    const me = makeParticipant({ puuid: "me", championName: "Yasuo" })
    const participants = [makeParticipant({ puuid: "other" }), me]
    expect(getPlaying(participants, "me")).toBe(me)
  })

  it("returns null when the puuid is not in the match", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    expect(getPlaying([makeParticipant({ puuid: "other" })], "me")).toBeNull()
    spy.mockRestore()
  })
})
