import type { Request, Response, NextFunction } from "express"

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint()

  // req.ip only reflects the real client if "trust proxy" is set (see app.ts below) —
  // otherwise it'll just report your reverse proxy / tailscale node.
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
        ?? req.ip
        ?? req.socket.remoteAddress

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ip} ${durationMs.toFixed(1)}ms`
    )
  })

  next()
}