import { describe, it, expect, afterEach } from "vitest"
import getLeagueKey from "./getLeagueKey.ts"

const saved = process.env.mongoUri

afterEach(() => {
  if (saved === undefined) {
    delete process.env.mongoUri
  } else {
    process.env.mongoUri = saved
  }
})

describe("getLeagueKey", () => {
  it("returns the mongo uri with the first ? expanded to league?", () => {
    process.env.mongoUri = "mongodb://user:pass@host:27017/db?retryWrites=true"
    expect(getLeagueKey()).toBe("mongodb://user:pass@host:27017/dbleague?retryWrites=true")
  })

  it("throws when mongoUri is not set", () => {
    delete process.env.mongoUri
    expect(() => getLeagueKey()).toThrow("mongoUri was not defined")
  })
})
