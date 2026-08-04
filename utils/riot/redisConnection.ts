// utils/redisConnection.ts
import IORedis from "ioredis"
import "dotenv/config"

const connection = new IORedis(process.env.redisUri ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null // required by BullMQ
})

// Every Queue/Worker/QueueEvents instance across all 4 riot tokens shares this
// single connection, and each attaches its own close/closing listener. That's
// expected with this multi-token setup, not a real leak — raise the cap
// instead of suppressing the warning.
connection.setMaxListeners(30)

export default connection