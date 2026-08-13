import { describe, it, expect } from "vitest"
import { checkDiscordId, getQueries } from "./inputValidation.ts"
import { z } from "zod"

const DISCORD_EPOCH = 1420070400000n

function snowflakeFromTimestamp(timestampMs: number): string {
  return String(((BigInt(timestampMs) - DISCORD_EPOCH) << 22n) + 1n)
}

describe("checkDiscordId", () => {
  it("accepts a real-format snowflake", () => {
    const id = snowflakeFromTimestamp(1610000000000) // ~2021
    expect(checkDiscordId(id)).toBe(true)
  })

  it("rejects strings that are too short", () => {
    expect(checkDiscordId("123456789")).toBe(false)
  })

  it("rejects non-numeric input", () => {
    expect(checkDiscordId("not-an-id")).toBe(false)
  })

  it("rejects snowflakes with a future timestamp", () => {
    const id = snowflakeFromTimestamp(Date.now() + 86400000) // tomorrow
    expect(checkDiscordId(id)).toBe(false)
  })
})

describe("getQueries", () => {
  const schema = z.object({
    championPlayed: z.string().optional(),
    championFighting: z.string().optional(),
  })

  it("normalizes champion names to PascalCase", () => {
    const parsed = getQueries({ championPlayed: "kai'sa", championFighting: "ww" }, schema)
    expect(parsed).toEqual({ championPlayed: "Kaisa", championFighting: "Warwick" })
  })

  it("throws a readable message on invalid input", () => {
    const strict = z.object({ count: z.number() })
    expect(() => getQueries({ count: "abc" }, strict)).toThrow()
  })
})
