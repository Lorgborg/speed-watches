import { describe, it, expect } from "vitest"
import getOpponent from "./getOpponent.ts"
import type Participant from "../types/participant.ts"

function makeParticipant(overrides: Partial<Participant>): Participant {
  return {
    puuid: "p1",
    championName: "Ahri",
    teamId: 100,
    individualPosition: "MIDDLE",
    ...overrides,
  } as Participant
}

describe("getOpponent", () => {
  it("returns the enemy champion in the same lane", () => {
    const participants = [
      makeParticipant({ puuid: "me", teamId: 100, individualPosition: "MIDDLE" }),
      makeParticipant({ puuid: "enemy", championName: "Yasuo", teamId: 200, individualPosition: "MIDDLE" }),
    ]
    expect(getOpponent(participants, "me")).toBe("Yasuo")
  })

  it("returns 'no opponent found' when no enemy shares the lane", () => {
    const participants = [
      makeParticipant({ puuid: "me", teamId: 100, individualPosition: "MIDDLE" }),
      makeParticipant({ puuid: "jungler", championName: "LeeSin", teamId: 200, individualPosition: "JUNGLE" }),
    ]
    expect(getOpponent(participants, "me")).toBe("no opponent found")
  })

  it("returns 'error' when the player is not in the match", () => {
    const participants = [makeParticipant({ puuid: "someone-else", teamId: 100 })]
    expect(getOpponent(participants, "me")).toBe("error")
  })
})
