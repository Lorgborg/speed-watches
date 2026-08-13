import { describe, it, expect, vi } from "vitest"
import type { NextFunction, Request, Response } from "express"
import { requestLogger } from "./requestLogging.ts"

interface ResMock {
  res: Response
  finish: () => void
}

function makeRes(statusCode = 200): ResMock {
  let finishHandler: (() => void) | undefined
  const res = {
    statusCode,
    on: vi.fn((event: string, cb: () => void) => {
      if (event === "finish") finishHandler = cb
    }),
  } as unknown as Response
  return { res, finish: () => finishHandler?.() }
}

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/get/user",
    headers: {},
    ip: "1.2.3.4",
    socket: { remoteAddress: "5.6.7.8" },
    ...overrides,
  } as unknown as Request
}

describe("requestLogger", () => {
  it("calls next() immediately", () => {
    const next = vi.fn() as unknown as NextFunction
    requestLogger(makeReq(), makeRes().res, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("logs the request on the finish event", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { res, finish } = makeRes(200)
    requestLogger(makeReq(), res, vi.fn() as unknown as NextFunction)
    finish()
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[.*\] GET \/api\/get\/user 200 1\.2\.3\.4 \d+\.\dms$/)
    )
    log.mockRestore()
  })

  it("uses the first x-forwarded-for entry when present", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { res, finish } = makeRes()
    requestLogger(
      makeReq({ headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" } }),
      res,
      vi.fn() as unknown as NextFunction
    )
    finish()
    expect(log).toHaveBeenCalledWith(expect.stringContaining("10.0.0.1"))
    log.mockRestore()
  })

  it("falls back to req.ip when x-forwarded-for is missing", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { res, finish } = makeRes()
    requestLogger(makeReq(), res, vi.fn() as unknown as NextFunction)
    finish()
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1.2.3.4"))
    log.mockRestore()
  })

  it("falls back to the socket address when neither is available", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { res, finish } = makeRes()
    requestLogger(
      makeReq({ ip: undefined, headers: {} }),
      res,
      vi.fn() as unknown as NextFunction
    )
    finish()
    expect(log).toHaveBeenCalledWith(expect.stringContaining("5.6.7.8"))
    log.mockRestore()
  })
})
