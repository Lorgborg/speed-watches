import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextFunction, Request, Response } from "express"

// Replace the real Redis connection with an in-memory fake so the test
// needs no services. The fake implements the same INCR/pexpire/pttl API.
vi.mock("../../riot/redisConnection.ts", () => {
  const counters = new Map<string, number>()
  const expiries = new Map<string, number>()
  return {
    default: {
      incr: vi.fn(async (key: string) => {
        const next = (counters.get(key) ?? 0) + 1
        counters.set(key, next)
        return next
      }),
      pexpire: vi.fn(async (key: string, ms: number) => {
        expiries.set(key, Date.now() + ms)
        return 1
      }),
      pttl: vi.fn(async (key: string) => {
        const expiry = expiries.get(key)
        if (expiry === undefined) return -2
        return Math.max(0, expiry - Date.now())
      }),
    },
    __reset: () => {
      counters.clear()
      expiries.clear()
    },
  }
})

import { apiKeyAuth } from "./apiKeyAuth.ts"

beforeEach(async () => {
  const mod = await import("../../riot/redisConnection.ts")
  ;(mod as unknown as { __reset: () => void }).__reset()
})

async function invoke(method: string, headers: Record<string, string | undefined> = {}) {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  const req = { method, headers } as unknown as Request
  await apiKeyAuth(req, res, next)
  return { res, next }
}

describe("apiKeyAuth", () => {
  it("rejects requests without a key", async () => {
    const { res, next } = await invoke("GET")
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("rejects unknown keys", async () => {
    const { res, next } = await invoke("GET", { authorization: "Bearer wrong-key" })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("allows a dev key on GET", async () => {
    const { res, next } = await invoke("GET", { authorization: "Bearer test-dev-key" })
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it("blocks a dev key on write methods", async () => {
    const { res, next } = await invoke("POST", { authorization: "Bearer test-dev-key" })
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it("allows an admin key on write methods", async () => {
    const { next } = await invoke("POST", { authorization: "Bearer test-admin-key" })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("rate limits a dev key after 30 requests", async () => {
    for (let i = 0; i < 30; i++) {
      const { next } = await invoke("GET", { authorization: "Bearer test-dev-key" })
      expect(next).toHaveBeenCalledTimes(1)
    }
    const { res } = await invoke("GET", { authorization: "Bearer test-dev-key" })
    expect(res.status).toHaveBeenCalledWith(429)
  })
})
