// utils/riotWorker.ts
import { Worker, Job, Queue, UnrecoverableError } from "bullmq"
import connection from "./redisConnection.ts"
import riotApi from "./riot.ts"
import { getRiotTokens } from "./riotTokens.ts"

async function overLongLimit(key: string, max: number, windowMs: number): Promise<number | null> {
  const count = await connection.incr(key)
  if (count === 1) await connection.pexpire(key, windowMs)
  if (count > max) {
    const ttl = await connection.pttl(key)
    return ttl > 0 ? ttl : windowMs
  }
  return null
}

function createRiotWorker(token: string, tokenIndex: number): Worker {
  const riot = new riotApi(token)
  const queueName = `riot-api-${tokenIndex}`
  const queue = new Queue(queueName, { connection: connection.duplicate() })
  const longKey = `riot:rl:${tokenIndex}:long`

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const { method, args } = job.data as { method: keyof riotApi; args: unknown[] }

      const longWait = await overLongLimit(longKey, 100, 120_000)
      if (longWait) {
        await queue.rateLimit(longWait)
        throw Worker.RateLimitError()
      }

      try {
        const fn = riot[method] as (...a: unknown[]) => Promise<{ data: unknown }>
        const res = await fn.apply(riot, args)
        return res.data
      } catch (e: unknown) {
        const err = e as {
          response?: { status?: number; headers?: Record<string, unknown>; data?: { status?: { message?: string } } }
          status?: number
          message?: string
        }
        const status = err.response?.status ?? err.status

        if (status === 429) {
          const retryAfterSec = Number(err.response?.headers?.["retry-after"] ?? 1)
          await queue.rateLimit(retryAfterSec * 1000 + 250)
          throw Worker.RateLimitError()
        }

        if (status === 400 || status === 401 || status === 403) {
          // permanent failures — retrying won't change the answer, fail now
          const label =
            status === 400 ? "not found" :
              status === 401 ? "invalid or expired key" :
                "forbidden"
          throw new UnrecoverableError(
            `Riot API ${status} (${label}): ${err.response?.data?.status?.message ?? err.message}`
          )
        }

        if (status === 409) {
          // transient conflict — let attempts/backoff retry it
          throw err
        }

        // anything else: default to normal retry behavior too,
        // unless you want to unrecoverable-fail more codes here
        throw err
      }
    },
    {
      connection: connection.duplicate(),
      concurrency: 20,
      limiter: { max: 14, duration: 1_000 }
    }
  )

  worker.on("failed", (job, err) => {
    console.log(`[riot-worker-${tokenIndex}] job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  console.log(`[riot-worker-${tokenIndex}] started`)
  return worker
}

const workers = getRiotTokens().map((token, i) => createRiotWorker(token, i))
export default workers