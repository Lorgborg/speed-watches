import Router from "express"
import { sql } from "../../util/services.ts"
import { getQueries } from "../../util/inputValidation.ts"
import { classifyQueryFields, buildWhereClause } from "../../util/querryClassifier.ts"
const router = Router()
import z from "zod"

const userQuerySchema = z.object({
  puuid: z.string().optional().describe("where"),
  discordId: z.string().optional().describe("where"),
  username: z.string().optional().describe("where")
})

router.get('/get/user', async (req, res) => {
  console.log("calling get/user")
  const parsed = getQueries(req.query, userQuerySchema)
  const { where } = classifyQueryFields(userQuerySchema.shape, parsed)
  const whereClause = buildWhereClause(where)
  const query = await sql`select * from users where ${whereClause}`
  res.send(query)
})

export default router