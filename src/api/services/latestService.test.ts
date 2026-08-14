import { describe, it, expect, vi, afterEach } from "vitest"
import type { Mock } from "vitest"
import { latestService } from "./latestService.ts"
import * as classifier from "../query/queryClassifier.ts"
import { sql } from "../../config/services.ts"
import z from "zod"

vi.mock("../query/queryClassifier.ts", () => ({
  classifyQueryFields: vi.fn(),
  buildWhereClause: vi.fn(),
}))
vi.mock("../../config/services.ts", () => ({
  sql: vi.fn(),
}))

// vi.mocked() keeps the real postgres/queryClassifier types, which fight the
// values we want to return. Cast once as vitest's Mock to make the setup
// declarations plain.
const sqlMock = sql as unknown as Mock
const classifyMock = classifier.classifyQueryFields as Mock
const buildWhereMock = classifier.buildWhereClause as Mock

describe("latestService", () => {
  const shape = {
    championFighting: z.string().optional(),
    championPlayed: z.string().optional(),
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns undefined when not both champion fields are provided", async () => {
    const parsed = { championFighting: "Ahri", championPlayed: undefined }
    const result = await latestService(shape, parsed)
    expect(result).toBeUndefined()
    expect(classifier.classifyQueryFields).not.toHaveBeenCalled()
    expect(sql).not.toHaveBeenCalled()
  })

  it("queries and returns the latest game when both champion fields are provided", async () => {
    const parsed = { championFighting: "Ahri", championPlayed: "Yasuo" }

    const mockWhere = ["some_where_clause"]
    const mockWhereClause = "WHERE condition"

    classifyMock.mockReturnValue({
      where: mockWhere,
      values: {},
      order: [],
    })
    buildWhereMock.mockReturnValue(mockWhereClause)

    const mockGame = {
      match_id: "NA1_123",
      game_creation: new Date(),
      champion_played: "Yasuo",
      champion_fighting: "Ahri",
      role: "MID",
      kda: "5/2/3",
      is_win: true,
    }
    sqlMock.mockResolvedValue([mockGame])

    const result = await latestService(shape, parsed)

    expect(classifier.classifyQueryFields).toHaveBeenCalledWith(shape, parsed)
    expect(classifier.buildWhereClause).toHaveBeenCalledWith(mockWhere)
    expect(sql).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      championFighting: "Ahri",
      championPlayed: "Yasuo",
      matchId: "NA1_123",
    })
  })

  it("rejects when no games found", async () => {
    const parsed = { championFighting: "Ahri", championPlayed: "Yasuo" }
    classifyMock.mockReturnValue({ where: [], values: {}, order: [] })
    buildWhereMock.mockReturnValue("WHERE 1=1")
    sqlMock.mockResolvedValue([])

    await expect(latestService(shape, parsed)).rejects.toThrow()
  })
})
