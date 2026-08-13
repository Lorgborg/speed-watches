import type { NextFunction, Request, Response } from "express"
import "dotenv/config"
import connection from "../../riot/redisConnection.ts"

export type ApiKeyRole = "dev" | "admin"

interface RateLimitConfig {
  max: number
  windowMs: number
}

const RATE_LIMITS: Record<ApiKeyRole, RateLimitConfig> = {
  // dev keys are for casual/read-only use — keep it strict
  dev: { max: 30, windowMs: 10 * 60 * 1000 },
  admin: { max: 120, windowMs: 60 * 1000 },
}

const DEV_API_KEY = process.env.DEV_API_KEY
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

if (!DEV_API_KEY || !ADMIN_API_KEY) {
  console.warn("apiKeyAuth: DEV_API_KEY/ADMIN_API_KEY missing from .env — every /api request will be rejected")
}

function extractKey(req: Request): string | undefined {
  const auth = req.headers.authorization
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length)
  }
  const header = req.headers["x-api-key"]
  return typeof header === "string" ? header : undefined
}

function roleForKey(key: string): ApiKeyRole | undefined {
  if (key === DEV_API_KEY) return "dev"
  if (key === ADMIN_API_KEY) return "admin"
  return undefined
}

/**
 * Per-key sliding window using the same Redis INCR pattern as the Riot
 * worker rate limiter. Returns ms to wait, or null if under the limit.
 */
async function rateLimitRemainingMs(role: ApiKeyRole, key: string): Promise<number | null> {
  const { max, windowMs } = RATE_LIMITS[role]
  const redisKey = `apikey:rl:${role}:${key}`
  const count = await connection.incr(redisKey)
  if (count === 1) await connection.pexpire(redisKey, windowMs)
  if (count > max) {
    const ttl = await connection.pttl(redisKey)
    return ttl > 0 ? ttl : windowMs
  }
  return null
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = extractKey(req)
  if (!key) {
    res.status(401).json({ error: "Missing API key. Send it as `Authorization: Bearer <key>`." })
    return
  }

  const role = roleForKey(key)
  if (!role) {
    res.status(401).json({ error: "Invalid API key" })
    return
  }

  try {
    const remainingMs = await rateLimitRemainingMs(role, key)
    if (remainingMs !== null) {
      res.setHeader("Retry-After", String(Math.ceil(remainingMs / 1000)))
      res.status(429).json({ error: "Rate limit exceeded" })
      return
    }
  } catch (e) {
    // Fail open: Redis being down shouldn't take the read API down with it.
    // The key check above still enforces auth, we just can't count requests.
    console.error("apiKeyAuth: rate limiter unavailable, allowing request:", e)
  }

  if (role === "dev" && req.method !== "GET") {
    res.status(403).json({ error: "Dev keys are read-only. Use an admin key for write operations." })
    return
  }

  res.locals.apiKeyRole = role
  next()
}
