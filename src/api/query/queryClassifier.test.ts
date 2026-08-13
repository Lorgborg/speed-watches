import { describe, it, expect } from "vitest"
import { z } from "zod"
import { classifyQueryFields, buildWhereClause, buildValueClause } from "./queryClassifier.ts" 

describe("classifyQueryFields", () => {
  const schema = z.object({
    championPlayed: z.string().optional().describe("where:games.champion_played"),
    notes: z.array(z.string()).optional().describe("value"),
    limit: z.string().optional().describe("limit"),
    noDescription: z.string().optional(),
  })

  it("classifies 'where' fields into the where array", () => {
    const { where } = classifyQueryFields(schema.shape, { championPlayed: "Ahri" })
    expect(where.length).toBe(1)
  })

  it("classifies 'value' fields into the values map by snake_case column", () => {
    const { values } = classifyQueryFields(schema.shape, { notes: ["nice"] })
    expect(values).toEqual({ notes: ["nice"] })
  })

  it("ignores fields without a description", () => {
    const { where, values } = classifyQueryFields(schema.shape, { noDescription: "x" })
    expect(where.length).toBe(0)
    expect(Object.keys(values).length).toBe(0)
  })
})

describe("buildWhereClause", () => {
  it("defaults to TRUE when there are no conditions", () => {
    const clause = buildWhereClause([])
    const strings = (clause as unknown as { strings: string[] }).strings
    expect(strings.join("")).toBe("TRUE")
  })
})

describe("buildValueClause", () => {
  it("throws instead of silently producing broken SQL when empty", () => {
    expect(() => buildValueClause({})).toThrow()
  })
})
