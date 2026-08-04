import IORedis from "ioredis"
import "dotenv/config"

const connection = new IORedis(process.env.redisUri ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null // required by BullMQ
})

export default connection