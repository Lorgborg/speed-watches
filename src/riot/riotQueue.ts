// utils/riotQueue.ts
import { Queue, QueueEvents } from "bullmq"
import type { AxiosResponse } from "axios"
import connection from "./redisConnection.ts"
import { getRiotTokens } from "./riotTokens.ts"
import riotApi from "./riot.ts"

const tokenCount = getRiotTokens().length

export const riotQueues = Array.from(
  { length: tokenCount },
  (_, i) => new Queue(`riot-api-${i}`, { connection })
)
const riotQueueEvents = riotQueues.map(q => new QueueEvents(q.name, { connection }))

/**
 * Calls a riotApi method on a specific token's queue.
 * tokenIndex MUST match whichever token the puuid involved was originally
 * resolved under — puuids are encrypted per-token and are not portable.
 * See resolveSummoner() for how a new user gets its token assigned.
 */
export async function callRiot<Args extends unknown[], R>(
  tokenIndex: number,
  method: (this: riotApi, ...args: Args) => Promise<AxiosResponse<R>>,
  ...args: Args
): Promise<R> {
  const methodName = method.name
  if (!methodName || typeof (riotApi.prototype as unknown as Record<string, unknown>)[methodName] !== "function") {
    throw new Error(`callRiot: "${methodName || method}" is not a recognized riotApi method`)
  }
  if (tokenIndex < 0 || tokenIndex >= riotQueues.length) {
    throw new Error(`callRiot: tokenIndex ${tokenIndex} out of range (have ${riotQueues.length} tokens)`)
  }

  const job = await riotQueues[tokenIndex].add(
    methodName,
    { method: methodName, args },
    { attempts: 8, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 }
  )
  console.log(`[riot-queue-${tokenIndex}] QUEUED job ${job.id} ${methodName}(${JSON.stringify(args)})`)
  return job.waitUntilFinished(riotQueueEvents[tokenIndex], 60000) as Promise<R>
}