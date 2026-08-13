import { describe, it, expect, vi, beforeEach } from "vitest"

describe("idToChampion", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  function mockDdragon(entries: Record<string, string>) {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ["15.1.1", "15.0.1"] })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: Object.fromEntries(
            Object.entries(entries).map(([name, key]) => [name, { key, id: name, name }])
          ),
        }),
      })
  }

  it("maps a numeric champion id to its display name", async () => {
    mockDdragon({ Ahri: "103", "Jarvan IV": "59" })
    const { idToChampion } = await import("./idToChampion.ts")
    await expect(idToChampion(103)).resolves.toBe("Ahri")
    await expect(idToChampion(59)).resolves.toBe("Jarvan IV")
  })

  it("fetches the champion data only once", async () => {
    mockDdragon({ Ahri: "103" })
    const { idToChampion } = await import("./idToChampion.ts")
    await idToChampion(103)
    await idToChampion(103)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws for an unknown champion id", async () => {
    mockDdragon({ Ahri: "103" })
    const { idToChampion } = await import("./idToChampion.ts")
    await expect(idToChampion(999)).rejects.toThrow("Unknown championId: 999")
  })
})
