import { describe, it, expect } from "vitest"
import { getChampionPascalCase } from "./getChampionPascal.ts"

describe("getChampionPascalCase", () => {
  it("converts spaced names to PascalCase", () => {
    expect(getChampionPascalCase("lee sin")).toBe("LeeSin")
    expect(getChampionPascalCase("master yi")).toBe("MasterYi")
  })

  it("expands nicknames through the exception map", () => {
    expect(getChampionPascalCase("ww")).toBe("Warwick")
    expect(getChampionPascalCase("tf")).toBe("TwistedFate")
    expect(getChampionPascalCase("j4")).toBe("JarvanIV")
  })

  it("handles apostrophe names", () => {
    expect(getChampionPascalCase("kai'sa")).toBe("Kaisa")
    expect(getChampionPascalCase("kha'zix")).toBe("Khazix")
  })
})
