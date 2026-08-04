// utils/riotWorker.ts
import { Worker, Job, Queue } from "bullmq"
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
    const queue = new Queue(queueName, { connection }) // handle to call queue.rateLimit()
    const longKey = `riot:rl:${tokenIndex}:long`

    const worker = new Worker(
        queueName,
        async (job: Job) => {
            const { method, args } = job.data as { method: keyof riotApi; args: any[] }

            // sustained cap (100/120s), layered on top of the built-in short-burst limiter below
            const longWait = await overLongLimit(longKey, 100, 120_000)
            if (longWait) {
                await queue.rateLimit(longWait)
                throw Worker.RateLimitError()
            }

            try {
                const fn = riot[method] as (...a: any[]) => Promise<any>
                const res = await fn.apply(riot, args)
                return res.data
            } catch (e: any) {
                const status = e?.response?.status ?? e?.status
                if (status === 429) {
                    const retryAfterSec = Number(e?.response?.headers?.["retry-after"] ?? 1)
                    await queue.rateLimit(retryAfterSec * 1000 + 250)
                    throw Worker.RateLimitError()
                }
                throw e
            }
        },
        {
            connection,
            concurrency: 20,
            limiter: { max: 20, duration: 1_000 } // built-in — replaces the manual short-window bucket entirely
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